# IPFS Handler for Zora Social Network Subgraph

This IPFS handler provides comprehensive functionality for fetching, parsing, and processing content from IPFS URIs in your Zora social network subgraph.

## Features

- **IPFS URI Parsing**: Extracts IPFS hashes from various URI formats
- **Content Fetching**: Uses The Graph's built-in `ipfs.cat()` function to fetch content
- **Metadata Extraction**: Parses JSON metadata and extracts common fields
- **Multiple Gateway Support**: Supports various IPFS gateways for redundancy
- **Error Handling**: Comprehensive error handling and logging

## Usage

### Basic Usage

```typescript
import { processIPFSContent } from "./ipfs-handler"

// Process an IPFS URI
const ipfsContent = processIPFSContent("ipfs://bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae")

if (ipfsContent) {
  // Access the hash
  const hash = ipfsContent.hash
  
  // Access the gateway URL
  const gatewayURL = ipfsContent.gatewayURL
  
  // Access parsed metadata
  const description = ipfsContent.getField("description")
  const image = ipfsContent.getField("image")
}
```

### Integration with Post Entity

The IPFS handler is integrated into the `handleCoinCreatedV4` function in `mapping.ts`:

```typescript
// Create post (ContentCoin)
let post = new Post(event.params.coin)
post.creator = event.params.caller
post.content = event.params.uri
post.contentURI = event.params.uri
// ... other fields ...

// Process IPFS content and populate fields
populateIPFSFields(post, event.params.uri)

post.save()
```

## Schema Fields

The `Post` entity now includes the following IPFS-related fields:

- `ipfsHash`: Extracted IPFS hash
- `ipfsGatewayURL`: IPFS gateway URL for fetching content
- `ipfsContentType`: Content type (e.g., "application/json")
- `ipfsMetadata`: Raw IPFS metadata JSON
- `ipfsDescription`: Parsed description from IPFS
- `ipfsImage`: Parsed image URL from IPFS
- `ipfsExternalUrl`: Parsed external URL from IPFS
- `ipfsAttributes`: Parsed attributes JSON from IPFS

## Supported URI Formats

The handler supports multiple IPFS URI formats:

- `ipfs://bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae`
- `https://ipfs.io/ipfs/bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae`
- `https://gateway.pinata.cloud/ipfs/bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae`
- `https://cloudflare-ipfs.com/ipfs/bafybeihrvrhjubmnuepyk6nqvwpslgfyxkemmdubbnfscchotttz343jae`

## IPFS Gateways

The handler supports multiple IPFS gateways for redundancy:

1. `https://ipfs.io/ipfs/`
2. `https://gateway.pinata.cloud/ipfs/`
3. `https://cloudflare-ipfs.com/ipfs/`
4. `https://dweb.link/ipfs/`

## Metadata Parsing

The handler automatically parses JSON metadata and extracts common fields:

- `name`: Content name
- `description`: Content description
- `image`: Image URL
- `external_url`: External URL
- `attributes`: Attributes array

## Error Handling

The handler includes comprehensive error handling:

- Invalid IPFS URI format detection
- IPFS content fetching failures
- JSON parsing errors
- Detailed logging for debugging

## Example Workflow

1. **Event Triggered**: `CoinCreatedV4` event is emitted with a `contentURI`
2. **IPFS Processing**: The handler extracts the IPFS hash and fetches content
3. **Metadata Parsing**: JSON metadata is parsed and common fields extracted
4. **Entity Population**: The `Post` entity is populated with IPFS fields
5. **Storage**: The enriched post data is saved to the subgraph

## Testing

You can test the IPFS handler using the example functions in `ipfs-examples.ts`:

```typescript
import { exampleIPFSUsage, handleDifferentIPFSFormats } from "./ipfs-examples"

// Run examples
exampleIPFSUsage()
handleDifferentIPFSFormats()
```

## Best Practices

1. **Always check for null**: The `processIPFSContent` function can return null
2. **Handle errors gracefully**: Use try-catch blocks when processing IPFS content
3. **Log important events**: The handler includes comprehensive logging
4. **Validate content**: Check if the fetched content is valid JSON before parsing

## Troubleshooting

### Common Issues

1. **IPFS content not found**: The hash might be invalid or content not available
2. **JSON parsing errors**: Content might not be valid JSON
3. **Network issues**: IPFS gateways might be temporarily unavailable

### Debugging

Enable detailed logging by checking the subgraph logs for:
- IPFS hash extraction
- Content fetching success/failure
- Metadata parsing results
- Error messages

## Future Enhancements

- Support for additional content types (images, videos)
- Caching mechanism for frequently accessed content
- Support for IPFS directory structures
- Enhanced metadata validation
