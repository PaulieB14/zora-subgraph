// IPFS Handler for Zora Social Network Subgraph
// Handles fetching and parsing content from IPFS URIs

import { log, json, JSONValue, Bytes, ipfs, JSONValueKind } from "@graphprotocol/graph-ts"

// IPFS Gateway URLs for fetching content
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/"
]

// Extract IPFS hash from URI
export function extractIPFSHash(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "")
  }
  if (uri.startsWith("https://") && uri.includes("/ipfs/")) {
    const parts = uri.split("/ipfs/")
    if (parts.length > 1) {
      return parts[1].split("/")[0] // Get hash before any additional path
    }
  }
  return ""
}

// Build IPFS gateway URL
export function buildIPFSURL(hash: string, gatewayIndex: i32 = 0): string {
  if (gatewayIndex >= IPFS_GATEWAYS.length) {
    gatewayIndex = 0
  }
  return IPFS_GATEWAYS[gatewayIndex] + hash
}

// Parse IPFS content URI and extract metadata
export function parseIPFSContent(contentURI: string): IPFSContent | null {
  const hash = extractIPFSHash(contentURI)
  if (!hash || hash.length == 0) {
    log.warning("Invalid IPFS URI: {}", [contentURI])
    return null
  }

  const gatewayURL = buildIPFSURL(hash)
  const ipfsContent = new IPFSContent(hash, contentURI, gatewayURL)
  
  // Try to fetch content from IPFS
  const ipfsData = ipfs.cat(hash)
  if (ipfsData) {
    const contentString = ipfsData.toString()
    log.info("Successfully fetched IPFS content for hash: {}, length: {}", [
      hash,
      contentString.length.toString()
    ])
    
    // Try to parse as JSON metadata with error handling
    if (ipfsContent.parseMetadata(contentString)) {
      log.info("Successfully parsed IPFS metadata for hash: {}", [hash])
    } else {
      log.warning("Failed to parse IPFS metadata as JSON for hash: {}", [hash])
      // Store raw content if not JSON
      ipfsContent.metadata = contentString
      ipfsContent.contentType = "text/plain"
    }
  } else {
    log.warning("Failed to fetch IPFS content for hash: {}", [hash])
  }

  return ipfsContent
}

// IPFS Content structure
export class IPFSContent {
  hash: string
  originalURI: string
  gatewayURL: string
  metadata: string | null
  contentType: string | null
  parsedData: Map<string, string>

  constructor(hash: string, originalURI: string, gatewayURL: string) {
    this.hash = hash
    this.originalURI = originalURI
    this.gatewayURL = gatewayURL
    this.metadata = null
    this.contentType = null
    this.parsedData = new Map<string, string>()
  }

  // Parse JSON metadata from IPFS content
  parseMetadata(jsonString: string): boolean {
    // First, try to clean the JSON string of invalid escape sequences
    const cleanedJson = this.cleanJsonString(jsonString)
    
    const jsonValue = json.fromString(cleanedJson)
    if (jsonValue.kind === JSONValueKind.OBJECT) {
      this.metadata = cleanedJson
      this.contentType = "application/json"
      
      const obj = jsonValue.toObject()
      if (obj) {
        // Extract name
        const name = obj.get("name")
        if (name && name.kind === JSONValueKind.STRING) {
          this.parsedData.set("name", name.toString())
        }
        
        // Extract description
        const description = obj.get("description")
        if (description && description.kind === JSONValueKind.STRING) {
          this.parsedData.set("description", description.toString())
        }
        
        // Extract image
        const image = obj.get("image")
        if (image && image.kind === JSONValueKind.STRING) {
          this.parsedData.set("image", image.toString())
        }
        
        // Extract external_url
        const externalUrl = obj.get("external_url")
        if (externalUrl && externalUrl.kind === JSONValueKind.STRING) {
          this.parsedData.set("external_url", externalUrl.toString())
        }
        
        // Extract attributes
        const attributes = obj.get("attributes")
        if (attributes && attributes.kind === JSONValueKind.ARRAY) {
          this.parsedData.set("attributes", attributes.toString())
        }
      }
      
      return true
    }
    
    // If JSON parsing fails, store raw content
    log.warning("Failed to parse JSON metadata: {}", [jsonString.substring(0, 200)])
    this.metadata = jsonString
    this.contentType = "text/plain"
    return false
  }

  // Clean JSON string by removing invalid escape sequences
  private cleanJsonString(jsonString: string): string {
    // Simple approach: just truncate at the first problematic character
    // This is safer than trying to fix malformed JSON
    let cleaned = jsonString
    
    // Find the last valid closing brace
    const lastBrace = cleaned.lastIndexOf('}')
    if (lastBrace > 0) {
      cleaned = cleaned.substring(0, lastBrace + 1)
    }
    
    // If the string is too short or doesn't start with {, return empty
    if (cleaned.length < 2 || cleaned.charAt(0) !== '{') {
      return '{}'
    }
    
    return cleaned
  }

  // Get parsed field value
  getField(key: string): string | null {
    if (this.parsedData.has(key)) {
      const value = this.parsedData.get(key)
      return value ? value : null
    }
    return null
  }

  // Check if content is valid
  isValid(): boolean {
    return this.hash.length > 0 && this.gatewayURL.length > 0
  }
}

// Utility function to handle IPFS content in mapping functions
export function processIPFSContent(contentURI: string): IPFSContent | null {
  if (!contentURI || contentURI.length === 0) {
    return null
  }

  const ipfsContent = parseIPFSContent(contentURI)
  if (!ipfsContent || !ipfsContent.isValid()) {
    log.warning("Failed to process IPFS content: {}", [contentURI])
    return null
  }

  log.info("Processed IPFS content - Hash: {}, URL: {}", [
    ipfsContent.hash,
    ipfsContent.gatewayURL
  ])

  return ipfsContent
}

// Extract metadata fields for schema storage
export function extractMetadataFields(ipfsContent: IPFSContent): Map<string, string> {
  const fields = new Map<string, string>()
  
  if (ipfsContent.parsedData) {
    // Copy all parsed data - iterate through known fields
    const knownFields = ["name", "description", "image", "external_url", "attributes"]
    for (let i = 0; i < knownFields.length; i++) {
      const key = knownFields[i]
      const value = ipfsContent.parsedData.get(key)
      if (value) {
        fields.set(key, value)
      }
    }
  }
  
  // Add IPFS-specific fields
  fields.set("ipfs_hash", ipfsContent.hash)
  fields.set("ipfs_gateway_url", ipfsContent.gatewayURL)
  fields.set("content_type", ipfsContent.contentType || "unknown")
  
  return fields
}
