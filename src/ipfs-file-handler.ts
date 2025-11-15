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
  // Load first - create if it doesn't exist (but don't save yet)
  let metadata = PostMetadata.load(cid)
  if (metadata == null) {
    // Create the entity - we'll save it once at the end after populating fields
    metadata = new PostMetadata(cid)
  }
  
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
  
  // CRITICAL: Final check right before save to prevent duplicates
  // Reload to ensure we're working with the actual persisted entity
  let finalMetadata = PostMetadata.load(cid)
  if (finalMetadata != null) {
    // Entity already exists - update it with our parsed data
    finalMetadata.contentType = metadata.contentType
    finalMetadata.metadata = metadata.metadata
    finalMetadata.description = metadata.description
    finalMetadata.image = metadata.image
    finalMetadata.externalUrl = metadata.externalUrl
    finalMetadata.content = metadata.content
    finalMetadata.attributes = metadata.attributes
    finalMetadata.save()
    log.info("Updated existing PostMetadata - CID: {}", [cid])
  } else {
    // Entity doesn't exist - save the one we created
    metadata.save()
    log.info("Created new PostMetadata - CID: {}", [cid])
  }
}
