// IPFS File Data Source Handler for Zora Social Network Subgraph
// This handler processes IPFS files fetched via File Data Sources
// File Data Sources ensure this handler runs exactly ONCE per unique CID
// NOTE: This file must be separate from mapping.ts and cannot import contract bindings
// VERSION: v3.3.0 - Bulletproof pattern: Check-before-create, parse, check-before-save
// Based on The Graph's official File Data Sources tutorial pattern

import { json, Bytes, dataSource, log, JSONValueKind } from "@graphprotocol/graph-ts"
import { PostMetadata } from "../generated/schema"

// File Data Source Handler - Called exactly once per CID when IPFS content is fetched
// THIS IS THE ONLY PLACE WE EVER CREATE PostMetadata ENTITIES
// The Graph Node guarantees:
// 1. File is fetched once per unique CID
// 2. Handler runs exactly once when file becomes available
// 3. Multiple PostMetadataTemplate.create() calls for same CID are deduplicated automatically
export function handlePostMetadata(content: Bytes): void {
  // Get the IPFS CID from the data source context
  // This is the CID passed to PostMetadataTemplate.create(cid)
  const cid = dataSource.stringParam()
  
  log.info("Processing IPFS metadata - CID: {}, size: {}", [
    cid,
    content.length.toString()
  ])

  // CRITICAL CHECK #1: Load entity BEFORE doing any work
  // If entity exists, return immediately - immutable entities cannot be updated
  let existingCheck = PostMetadata.load(cid)
  if (existingCheck != null) {
    log.warning("PostMetadata already exists for CID: {} - skipping (immutable entity, already processed)", [cid])
    return
  }

  // Entity doesn't exist - create it now
  // Following the tutorial pattern: create entity, populate fields, save
  let metadata = new PostMetadata(cid)
  
  // Parse JSON metadata from bytes
  const jsonValue = json.fromBytes(content)
  
  if (jsonValue.kind === JSONValueKind.OBJECT) {
    const parsedData = jsonValue.toObject()
    if (parsedData != null) {
      metadata.contentType = "application/json"
      metadata.metadata = content.toString()
      
      // Extract description
      const description = parsedData.get("description")
      if (description != null && description.kind === JSONValueKind.STRING) {
        metadata.description = description.toString()
      }
      
      // Extract image
      const image = parsedData.get("image")
      if (image != null && image.kind === JSONValueKind.STRING) {
        metadata.image = image.toString()
      }
      
      // Extract external_url
      const externalUrl = parsedData.get("external_url")
      if (externalUrl != null && externalUrl.kind === JSONValueKind.STRING) {
        metadata.externalUrl = externalUrl.toString()
      }
      
      // Extract content (the actual post text/content)
      const contentField = parsedData.get("content")
      if (contentField != null) {
        if (contentField.kind === JSONValueKind.STRING) {
          metadata.content = contentField.toString()
        } else if (contentField.kind === JSONValueKind.OBJECT) {
          // Content might be an object with uri, mime, etc.
          const contentObj = contentField.toObject()
          if (contentObj != null) {
            const uri = contentObj.get("uri")
            if (uri != null && uri.kind === JSONValueKind.STRING) {
              metadata.content = uri.toString()
            }
          }
        }
      }
      
      // Extract attributes
      const attributes = parsedData.get("attributes")
      if (attributes != null && attributes.kind === JSONValueKind.ARRAY) {
        metadata.attributes = attributes.toString()
      }
      
      log.info("Successfully parsed IPFS metadata - CID: {}", [cid])
    }
  } else {
    // Not JSON, store as raw content
    log.warning("IPFS content is not JSON - CID: {}", [cid])
    metadata.contentType = "text/plain"
    metadata.content = content.toString()
  }
  
  // CRITICAL CHECK #2: Reload entity right before save to prevent race conditions
  // Another handler might have created it between our initial check and now
  // Since PostMetadata is immutable, we MUST NOT save if it already exists
  let finalCheck = PostMetadata.load(cid)
  if (finalCheck != null) {
    // Entity was created by another handler - skip save to prevent duplicate key error
    // This should never happen with proper File Data Source deduplication, but we protect against it
    log.warning("PostMetadata already exists before save for CID: {} - skipping save (immutable entity, race condition detected)", [cid])
    return
  }
  
  // Save the entity - PostMetadata is immutable, so this can only happen once per CID
  // File Data Sources guarantee this handler runs exactly once per CID
  metadata.save()
  log.info("Successfully saved PostMetadata - CID: {}", [cid])
}
