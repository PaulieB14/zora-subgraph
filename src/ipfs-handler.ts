// IPFS Helper Functions for Zora Social Network Subgraph
// These helper functions are used by mapping.ts to process IPFS URIs
// NOTE: The actual IPFS file handler is in ipfs-file-handler.ts (used by subgraph.yaml)

// Helper function to extract IPFS hash from URI (used in mapping.ts)
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

// Helper function to build IPFS gateway URL (for client-side fetching fallback)
export function buildIPFSURL(hash: string, gatewayIndex: i32 = 0): string {
  const IPFS_GATEWAYS = [
    "https://ipfs.io/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://dweb.link/ipfs/"
  ]
  
  if (gatewayIndex >= IPFS_GATEWAYS.length) {
    gatewayIndex = 0
  }
  return IPFS_GATEWAYS[gatewayIndex] + hash
}
