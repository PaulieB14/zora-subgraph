// Example usage of IPFS Handler for Zora Social Network
// This file demonstrates how to use the IPFS handler to fetch and parse content

import { log } from "@graphprotocol/graph-ts"
import { processIPFSContent, extractMetadataFields, IPFSContent } from "./ipfs-handler"

// Example function showing how to use the IPFS handler
export function exampleIPFSUsage(): void {
  // Example IPFS URI from Zora
  const exampleURI = "ipfs://bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae"
  
  log.info("Processing IPFS URI: {}", [exampleURI])
  
  // Process the IPFS content
  const ipfsContent = processIPFSContent(exampleURI)
  
  if (ipfsContent) {
    log.info("Successfully processed IPFS content")
    log.info("Hash: {}", [ipfsContent.hash])
    log.info("Gateway URL: {}", [ipfsContent.gatewayURL])
    log.info("Content Type: {}", [ipfsContent.contentType || "unknown"])
    
    // Extract metadata fields
    const metadataFields = extractMetadataFields(ipfsContent)
    
    // Log extracted fields
    const keys = metadataFields.keys()
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = metadataFields.get(key)
      if (value) {
        log.info("Metadata field {}: {}", [key, value])
      }
    }
    
    // Example of accessing specific fields
    const description = ipfsContent.getField("description")
    if (description) {
      log.info("Description: {}", [description])
    }
    
    const image = ipfsContent.getField("image")
    if (image) {
      log.info("Image URL: {}", [image])
    }
    
  } else {
    log.warning("Failed to process IPFS content")
  }
}

// Example of how to handle different IPFS URI formats
export function handleDifferentIPFSFormats(): void {
  const uris = [
    "ipfs://bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae",
    "https://ipfs.io/ipfs/bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae",
    "https://gateway.pinata.cloud/ipfs/bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae"
  ]
  
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i]
    log.info("Processing URI format {}: {}", [i.toString(), uri])
    
    const ipfsContent = processIPFSContent(uri)
    if (ipfsContent) {
      log.info("Successfully processed URI format {}", [i.toString()])
    } else {
      log.warning("Failed to process URI format {}", [i.toString()])
    }
  }
}

// Example of handling IPFS content in a Post entity
export function populatePostWithIPFSContent(postId: string, contentURI: string): void {
  log.info("Populating post {} with IPFS content from URI: {}", [postId, contentURI])
  
  const ipfsContent = processIPFSContent(contentURI)
  if (ipfsContent) {
    // In a real implementation, you would load the Post entity and set these fields:
    // post.ipfsHash = ipfsContent.hash
    // post.ipfsGatewayURL = ipfsContent.gatewayURL
    // post.ipfsContentType = ipfsContent.contentType
    // post.ipfsMetadata = ipfsContent.metadata
    // post.ipfsDescription = ipfsContent.getField("description")
    // post.ipfsImage = ipfsContent.getField("image")
    // post.ipfsExternalUrl = ipfsContent.getField("external_url")
    // post.ipfsAttributes = ipfsContent.getField("attributes")
    // post.save()
    
    log.info("Post {} populated with IPFS hash: {}", [postId, ipfsContent.hash])
  } else {
    log.warning("Failed to populate post {} with IPFS content", [postId])
  }
}
