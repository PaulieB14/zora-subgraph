// IPFS File Data Source Handler for Zora Social Network Subgraph
// This handler processes IPFS files fetched via File Data Sources
// File Data Sources ensure this handler runs exactly ONCE per unique CID
// NOTE: This file must be separate from mapping.ts and cannot import contract bindings
// VERSION: v3.0.5 - Canonical pattern: File Data Source is the ONLY place that creates PostMetadata

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
  const cid = dataSource.stringParam()
  
  log.info("Processing IPFS metadata - CID: {}, size: {}", [
    cid,
    content.length.toString()
  ])

  // THIS IS THE ONLY PLACE WE EVER CREATE THE ENTITY
  // ALWAYS load first - if it exists, we're done (already processed)
  let metadata = PostMetadata.load(cid)
  if (metadata != null) {
    // Entity already exists and is populated - File Data Source ran twice somehow
    // This shouldn't happen, but if it does, just return to avoid duplicate key error
    log.warning("PostMetadata already exists for CID: {} - skipping (File Data Source ran twice?)", [cid])
    return
  }
  
  // Entity doesn't exist - create it now
  metadata = new PostMetadata(cid)
  
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
  
  // CRITICAL: PostMetadata is immutable - we can NEVER update it, only create once
  // Check one final time right before save - if it exists, skip save to prevent duplicate key error
  let finalCheck = PostMetadata.load(cid)
  if (finalCheck != null) {
    // Entity already exists - cannot update immutable entity, just skip
    log.warning("PostMetadata already exists for CID: {} - skipping save (immutable entity)", [cid])
    return
  }
  
  // Entity doesn't exist - save the one we created
  // This is the only place we save - immutable entities can only be created once
  metadata.save()
  log.info("Created new PostMetadata - CID: {}", [cid])
}
