// IPFS File Data Source Handler for Zora Social Network Subgraph
// This handler processes IPFS files fetched via File Data Sources
// File Data Sources ensure this handler runs exactly ONCE per unique CID
// NOTE: This file must be separate from mapping.ts and cannot import contract bindings
// VERSION: v3.9.0 - Defensive check REQUIRED for CID-based entity IDs
// Tutorial uses Post ID (unique per post), but we use CID (one per CID)
// Multiple posts can reference same CID, so handler may be called multiple times
// MUST check if entity exists before creating to prevent duplicate key errors

import { json, Bytes, dataSource, log, JSONValueKind } from "@graphprotocol/graph-ts"
import { PostMetadata } from "../generated/schema"

// File Data Source Handler - Called exactly once per CID when IPFS content is fetched
// THIS IS THE ONLY PLACE WE EVER CREATE PostMetadata ENTITIES
// CRITICAL: Must check if entity exists because we use CID as entity ID
// Unlike tutorial (Post ID per post), we have one entity per CID (shared by multiple posts)
export function handlePostMetadata(content: Bytes): void {
  // Get the IPFS CID from the data source context
  // This is the CID passed to PostMetadataTemplate.create(cid)
  const cid = dataSource.stringParam()
  
  log.info("Processing IPFS metadata - CID: {}, size: {}", [
    cid,
    content.length.toString()
  ])

  // CRITICAL: Check if entity already exists
  // Unlike tutorial (Post ID = unique per post), we use CID as ID
  // Multiple posts can reference same CID, causing handler to run multiple times
  // If entity exists (immutable), we cannot update it, so return early
  let metadata = PostMetadata.load(cid)
  if (metadata != null) {
    log.warning("PostMetadata already exists for CID: {} - skipping (immutable entity, already processed)", [cid])
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
  
  // Save the entity - following tutorial pattern exactly
  // Tutorial shows: post.save(); with no checks before or after
  // File Data Sources guarantee this handler runs exactly once per CID
  // Version: v3.8.2 - Tutorial pattern: direct create and save
  metadata.save()
  log.info("Successfully saved PostMetadata - CID: {}", [cid])
}
