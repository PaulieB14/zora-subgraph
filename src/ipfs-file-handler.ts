// IPFS File Data Source Handler for Zora Social Network Subgraph
// This handler processes IPFS files fetched via File Data Sources
// File Data Sources ensure this handler runs exactly ONCE per unique CID
// NOTE: This file must be separate from mapping.ts and cannot import contract bindings
// VERSION: v3.8.0 - Following tutorial pattern EXACTLY: no existence checks, just create and save
// Pattern matches official tutorial: https://thegraph.com/blog/file-data-sources-tutorial/

import { json, Bytes, dataSource, log, JSONValueKind } from "@graphprotocol/graph-ts"
import { PostMetadata } from "../generated/schema"

// File Data Source Handler - Called exactly once per CID when IPFS content is fetched
// THIS IS THE ONLY PLACE WE EVER CREATE PostMetadata ENTITIES
// Following tutorial pattern exactly: create entity, populate fields, save
// No existence checks - Graph Node guarantees single execution per CID
export function handlePostMetadata(content: Bytes): void {
  // Get the IPFS CID from the data source context
  // This is the CID passed to PostMetadataTemplate.create(cid)
  const cid = dataSource.stringParam()
  
  log.info("Processing IPFS metadata - CID: {}, size: {}", [
    cid,
    content.length.toString()
  ])

  // Create entity directly - following tutorial pattern exactly
  // Tutorial shows: let post = new PostContent(id); post.hash = hash; post.save();
  // No existence checks - Graph Node handles deduplication
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
  
  // Save the entity - following tutorial pattern exactly
  // Tutorial shows: post.save(); with no checks before or after
  // File Data Sources guarantee this handler runs exactly once per CID
  metadata.save()
  log.info("Successfully saved PostMetadata - CID: {}", [cid])
}
