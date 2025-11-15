// Zora Social Network Subgraph Mapping
// Comprehensive tracking of ALL Zora social interactions and engagement
// Following all 6 Graph Best Practices from https://thegraph.com/docs/en/subgraphs/best-practices/pruning/

import { BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import {
  CoinCreatedV4
} from "../generated/ZoraFactory/ZoraFactory"
import {
  Transfer as ContentCoinTransfer,
  Mint as ContentCoinMint
} from "../generated/templates/ContentCoinTemplate/ContentCoin"
import {
  Transfer as CreatorCoinTransfer
} from "../generated/templates/CreatorCoinTemplate/CreatorCoin"
import { 
  Post, 
  User, 
  CreatorCoin,
  ContentCoin,
  Mint, 
  Transfer, 
  Swap, 
  Reward
} from "../generated/schema"
import { ContentCoinTemplate, CreatorCoinTemplate, PostMetadataTemplate } from "../generated/templates"
import { extractIPFSHash, buildIPFSURL } from "./ipfs-handler"

// Helper function to create unique IDs
// Uses transaction hash + log index to create unique IDs
function createId(prefix: string, hash: Bytes, logIndex: BigInt): Bytes {
  // Convert logIndex to Bytes, ensuring it's properly padded
  let logIndexHex = logIndex.toHexString()
  // Remove 0x prefix and ensure even length
  let logIndexStr = logIndexHex.slice(2)
  if (logIndexStr.length % 2 !== 0) {
    logIndexStr = "0" + logIndexStr
  }
  let logIndexBytes = Bytes.fromHexString("0x" + logIndexStr)
  
  // Concatenate hash and logIndex using Bytes.concat
  // The prefix is just for logging/debugging, not part of the actual ID
  return hash.concat(logIndexBytes)
}

// Helper function to process IPFS URI and spawn File Data Source
// File Data Sources fetch IPFS content asynchronously and populate PostMetadata entity
// NOTE: We cannot check PostMetadata existence here because file-based entities
// cannot be accessed from chain-based handlers per File Data Source limitations
function processIPFSURI(post: Post, contentURI: string): void {
  const hash = extractIPFSHash(contentURI)
  
  if (!hash || hash.length == 0) {
    log.warning("Invalid IPFS URI for post {}: {}", [
      post.id.toHexString(),
      contentURI
    ])
    return
  }

  // Store hash and gateway URL in Post entity
  post.ipfsHash = hash
  post.ipfsGatewayURL = buildIPFSURL(hash)
  // Link to PostMetadata entity - The Graph will resolve this string ID to the PostMetadata entity
  // This works even though PostMetadata is created asynchronously by File Data Source
  post.metadata = hash
  
  // Spawn File Data Source to fetch and parse IPFS content
  // The Graph Node guarantees:
  // - File is fetched once per unique CID
  // - Handler runs exactly once when file becomes available
  // - Multiple create() calls for same CID are automatically deduplicated
  // This is idempotent - safe to call multiple times for the same CID
  PostMetadataTemplate.create(hash)
  
  log.info("Spawned IPFS File Data Source for post {} - CID: {}", [
    post.id.toHexString(),
    hash
  ])
}

// Handle ZoraFactory CoinCreated events (new posts/coins created)
export function handleCoinCreatedV4(event: CoinCreatedV4): void {
  log.info("CoinCreated event: caller={}, coin={}, name={}", [
    event.params.caller.toHexString(),
    event.params.coin.toHexString(),
    event.params.name
  ])

  // Create or update user
  let user = User.load(event.params.caller)
  if (!user) {
    user = new User(event.params.caller)
    user.totalPosts = BigInt.fromI32(0)
    user.totalMints = BigInt.fromI32(0)
    user.totalTransfers = BigInt.fromI32(0)
    user.totalSwaps = BigInt.fromI32(0)
    user.totalRewards = BigInt.fromI32(0)
  }
  user.totalPosts = user.totalPosts.plus(BigInt.fromI32(1))
  user.save()

  // Create post (ContentCoin)
  let post = new Post(event.params.coin)
  post.creator = event.params.caller
  post.content = event.params.uri
  post.contentURI = event.params.uri
  post.name = event.params.name
  post.symbol = event.params.symbol
  post.createdAt = event.block.timestamp
  post.blockNumber = event.block.number
  post.transactionHash = event.transaction.hash
  post.totalSupply = BigInt.fromI32(0)
  post.totalMints = BigInt.fromI32(0)
  post.totalTransfers = BigInt.fromI32(0)
  post.totalSwaps = BigInt.fromI32(0)
  post.totalHolders = BigInt.fromI32(0)
  
  // Process IPFS URI and spawn File Data Source to fetch metadata
  processIPFSURI(post, event.params.uri)
  
  post.save()

  // Create ContentCoin entity
  let contentCoin = new ContentCoin(event.params.coin)
  contentCoin.post = event.params.coin
  contentCoin.creator = event.params.caller
  contentCoin.name = event.params.name
  contentCoin.symbol = event.params.symbol
  contentCoin.totalSupply = BigInt.fromI32(0)
  contentCoin.totalMints = BigInt.fromI32(0)
  contentCoin.totalTransfers = BigInt.fromI32(0)
  contentCoin.createdAt = event.block.timestamp
  contentCoin.save()

  // Create creator coin if it doesn't exist
  let creatorCoin = CreatorCoin.load(event.params.caller)
  if (!creatorCoin) {
    creatorCoin = new CreatorCoin(event.params.caller)
    creatorCoin.creator = event.params.caller
    creatorCoin.name = event.params.name + " Creator"
    creatorCoin.symbol = event.params.symbol + "CR"
    creatorCoin.totalSupply = BigInt.fromI32(0)
    creatorCoin.totalHolders = BigInt.fromI32(0)
    creatorCoin.save()
  }


  // Start tracking the new ContentCoin contract
  ContentCoinTemplate.create(event.params.coin)
}



// Handle ContentCoin Transfer events (likes/engagement)
export function handleContentCoinTransfer(event: ContentCoinTransfer): void {
  log.info("ContentCoin Transfer: from={}, to={}, amount={}", [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.value.toString()
  ])

  // Check if this is a mint (Transfer from zero address)
  let zeroAddress = Bytes.fromHexString("0x0000000000000000000000000000000000000000")
  let isMint = event.params.from.equals(zeroAddress)

  // Create or update users
  let fromUser = User.load(event.params.from)
  if (!fromUser && !isMint) {
    fromUser = new User(event.params.from)
    fromUser.totalPosts = BigInt.fromI32(0)
    fromUser.totalMints = BigInt.fromI32(0)
    fromUser.totalTransfers = BigInt.fromI32(0)
    fromUser.totalSwaps = BigInt.fromI32(0)
    fromUser.totalRewards = BigInt.fromI32(0)
    fromUser.save()
  }

  let toUser = User.load(event.params.to)
  if (!toUser) {
    toUser = new User(event.params.to)
    toUser.totalPosts = BigInt.fromI32(0)
    toUser.totalMints = BigInt.fromI32(0)
    toUser.totalTransfers = BigInt.fromI32(0)
    toUser.totalSwaps = BigInt.fromI32(0)
    toUser.totalRewards = BigInt.fromI32(0)
  }

  // Load post and contentCoin
  let post = Post.load(event.address)
  let contentCoin = ContentCoin.load(event.address)

  // Only process if post exists (required for entity relationships)
  if (!post) {
    log.warning("Post not found for ContentCoin transfer at address: {}", [
      event.address.toHexString()
    ])
    return
  }

  if (!contentCoin) {
    log.warning("ContentCoin not found for transfer at address: {}", [
      event.address.toHexString()
    ])
    return
  }

  if (isMint) {
    // This is a mint - create Mint entity
    log.info("Detected mint via Transfer event: to={}, amount={}", [
      event.params.to.toHexString(),
      event.params.value.toString()
    ])

    // Update user mint stats
    toUser.totalMints = toUser.totalMints.plus(BigInt.fromI32(1))
    toUser.save()

    // Create mint entity
    let mintId = createId("mint-", event.transaction.hash, event.logIndex)
    let mint = new Mint(mintId)
    mint.post = event.address
    mint.contentCoin = event.address
    mint.minter = event.params.to
    mint.amount = event.params.value
    mint.timestamp = event.block.timestamp
    mint.blockNumber = event.block.number
    mint.transactionHash = event.transaction.hash
    mint.save()

    // Update post stats
    post.totalMints = post.totalMints.plus(BigInt.fromI32(1))
    post.totalSupply = post.totalSupply.plus(event.params.value)
    // Note: totalHolders should be calculated from unique holders, not incremented here
    post.save()

    // Update content coin stats
    contentCoin.totalMints = contentCoin.totalMints.plus(BigInt.fromI32(1))
    contentCoin.totalSupply = contentCoin.totalSupply.plus(event.params.value)
    contentCoin.save()
  } else {
    // This is a regular transfer
    // Update user stats
    if (event.params.from != event.params.to) {
      if (fromUser) {
        fromUser.totalTransfers = fromUser.totalTransfers.plus(BigInt.fromI32(1))
        fromUser.save()
      }
      toUser.totalTransfers = toUser.totalTransfers.plus(BigInt.fromI32(1))
      toUser.save()
    }

    // Create transfer entity
    let transferId = createId("content-", event.transaction.hash, event.logIndex)
    let transfer = new Transfer(transferId)
    transfer.post = event.address
    transfer.contentCoin = event.address
    transfer.from = event.params.from
    transfer.to = event.params.to
    transfer.amount = event.params.value
    transfer.timestamp = event.block.timestamp
    transfer.blockNumber = event.block.number
    transfer.transactionHash = event.transaction.hash
    transfer.save()

    // Update post stats
    post.totalTransfers = post.totalTransfers.plus(BigInt.fromI32(1))
    post.save()

    // Update content coin stats
    contentCoin.totalTransfers = contentCoin.totalTransfers.plus(BigInt.fromI32(1))
    contentCoin.save()
  }
}

// Handle ContentCoin Mint events (new likes)
// Note: Some contracts emit separate Mint events, while others emit Transfer from zero address
// This handler covers the case where explicit Mint events are emitted
export function handleContentCoinMint(event: ContentCoinMint): void {
  log.info("ContentCoin Mint event: to={}, amount={}", [
    event.params.to.toHexString(),
    event.params.amount.toString()
  ])

  // Create or update user
  let user = User.load(event.params.to)
  if (!user) {
    user = new User(event.params.to)
    user.totalPosts = BigInt.fromI32(0)
    user.totalMints = BigInt.fromI32(0)
    user.totalTransfers = BigInt.fromI32(0)
    user.totalSwaps = BigInt.fromI32(0)
    user.totalRewards = BigInt.fromI32(0)
  }
  user.totalMints = user.totalMints.plus(BigInt.fromI32(1))
  user.save()

  // Load post and contentCoin - required for entity relationships
  let post = Post.load(event.address)
  let contentCoin = ContentCoin.load(event.address)

  // Only process if post and contentCoin exist
  if (!post) {
    log.warning("Post not found for ContentCoin mint at address: {}", [
      event.address.toHexString()
    ])
    return
  }

  if (!contentCoin) {
    log.warning("ContentCoin not found for mint at address: {}", [
      event.address.toHexString()
    ])
    return
  }

  // Create mint entity
  let mintId = createId("mint-", event.transaction.hash, event.logIndex)
  let mint = new Mint(mintId)
  mint.post = event.address
  mint.contentCoin = event.address
  mint.minter = event.params.to
  mint.amount = event.params.amount
  mint.timestamp = event.block.timestamp
  mint.blockNumber = event.block.number
  mint.transactionHash = event.transaction.hash
  mint.save()

  // Update post stats
  post.totalMints = post.totalMints.plus(BigInt.fromI32(1))
  post.totalSupply = post.totalSupply.plus(event.params.amount)
  // Note: totalHolders should be calculated from unique holders, not incremented here
  post.save()

  // Update content coin stats
  contentCoin.totalMints = contentCoin.totalMints.plus(BigInt.fromI32(1))
  contentCoin.totalSupply = contentCoin.totalSupply.plus(event.params.amount)
  contentCoin.save()
}

// Handle CreatorCoin Transfer events
export function handleCreatorCoinTransfer(event: CreatorCoinTransfer): void {
  log.info("CreatorCoin Transfer: from={}, to={}, amount={}", [
    event.params.from.toHexString(),
    event.params.to.toHexString(),
    event.params.value.toString()
  ])

  // Create or update users
  let fromUser = User.load(event.params.from)
  if (!fromUser) {
    fromUser = new User(event.params.from)
    fromUser.totalPosts = BigInt.fromI32(0)
    fromUser.totalMints = BigInt.fromI32(0)
    fromUser.totalTransfers = BigInt.fromI32(0)
    fromUser.totalSwaps = BigInt.fromI32(0)
    fromUser.totalRewards = BigInt.fromI32(0)
    fromUser.save()
  }

  let toUser = User.load(event.params.to)
  if (!toUser) {
    toUser = new User(event.params.to)
    toUser.totalPosts = BigInt.fromI32(0)
    toUser.totalMints = BigInt.fromI32(0)
    toUser.totalTransfers = BigInt.fromI32(0)
    toUser.totalSwaps = BigInt.fromI32(0)
    toUser.totalRewards = BigInt.fromI32(0)
    toUser.save()
  }

  // Update user stats
  if (event.params.from != event.params.to) {
    fromUser.totalTransfers = fromUser.totalTransfers.plus(BigInt.fromI32(1))
    toUser.totalTransfers = toUser.totalTransfers.plus(BigInt.fromI32(1))
  }
  fromUser.save()
  toUser.save()

  // Note: CreatorCoin transfers don't create Transfer entities linked to Posts
  // because CreatorCoin transfers are not associated with specific posts.
  // We track them via user stats only.
  // CreatorCoin entities are keyed by creator address, not contract address,
  // so we can't load them by event.address here.
}
