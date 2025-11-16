// IPFS File Data Source Handler for Zora Social Network Subgraph
// This handler processes IPFS files fetched via File Data Sources
// File Data Sources ensure this handler runs exactly ONCE per unique CID
// NOTE: This file must be separate from mapping.ts and cannot import contract bindings
// VERSION: v3.14.0 - Load-or-update pattern with immutable: false to prevent vid errors
// Official tutorial uses Post ID per post; we intentionally reuse CID across posts
// Multiple posts referencing same CID means handler can run multiple times per CID
// Using immutable: false lets us update an existing entity instead of racing on creation

import { json, Bytes, dataSource, log, JSONValueKind } from "@graphprotocol/graph-ts"
import { PostMetadata } from "../generated/schema"

// File Data Source Handler - Called exactly once per CID when IPFS content is fetched
// THIS IS THE ONLY PLACE WE EVER CREATE PostMetadata ENTITIES
// CRITICAL: Must load-or-create because we use CID as entity ID (shared by many posts)
// Official example uses Post ID (unique per post), but we intentionally dedupe by CID
export function handlePostMetadata(content: Bytes): void {
  // Get the IPFS CID from the data source context
  // This is the CID passed to PostMetadataTemplate.create(cid)
  const cid = dataSource.stringParam()
  
  log.info("Processing IPFS metadata - CID: {}, size: {}", [
    cid,
    content.length.toString()
  ])

  // Load existing entity if one already exists (shared CID)
  // With immutable: false we can safely update the same record
  let metadata = PostMetadata.load(cid)
  if (metadata == null) {
    // This should be rare (mapping should have created the shell),
    // but fallback to creating one here if necessary.
    metadata = new PostMetadata(cid)
    metadata.save()
    log.warning(
      "PostMetadata shell missing in handler for CID: {} - created fallback shell",
      [cid]
    )
    // Reload the entity so subsequent save is treated as an update, not a second insert
    let reloaded = PostMetadata.load(cid)
    if (reloaded != null) {
      metadata = reloaded
    }
  }
  
  // Parse JSON metadata from bytes FIRST, before any save operations
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
  
  // Save the entity - load-or-update pattern
  // File Data Sources generally run once per CID, but this is safe if they don't
  metadata.save()
  log.info("Successfully saved PostMetadata - CID: {}", [cid])
}
