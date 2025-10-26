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
import { ContentCoinTemplate, CreatorCoinTemplate } from "../generated/templates"

// Helper function to create unique IDs
function createId(prefix: string, hash: Bytes, logIndex: BigInt): Bytes {
  let hashStr = hash.toHexString().slice(2) // Remove 0x prefix
  let logStr = logIndex.toHexString().slice(2) // Remove 0x prefix
  
  // Ensure even length by padding with 0 if needed
  if (logStr.length % 2 !== 0) {
    logStr = "0" + logStr
  }
  
  let combined = prefix + hashStr + logStr
  return Bytes.fromHexString(combined)
}

// Handle ZoraFactory CoinCreatedV4 events (new posts/coins created)
export function handleCoinCreatedV4(event: CoinCreatedV4): void {
  log.info("CoinCreatedV4 event: caller={}, coin={}, name={}", [
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

  // Create or update users
  let fromUser = User.load(event.params.from)
  if (!fromUser) {
    fromUser = new User(event.params.from)
    fromUser.totalPosts = BigInt.fromI32(0)
    fromUser.totalMints = BigInt.fromI32(0)
    fromUser.totalTransfers = BigInt.fromI32(0)
    fromUser.totalSwaps = BigInt.fromI32(0)
    fromUser.totalRewards = BigInt.fromI32(0)
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

  // Update user stats
  if (event.params.from != event.params.to) {
    fromUser.totalTransfers = fromUser.totalTransfers.plus(BigInt.fromI32(1))
    toUser.totalTransfers = toUser.totalTransfers.plus(BigInt.fromI32(1))
  }
  fromUser.save()
  toUser.save()

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
  let post = Post.load(event.address)
  if (post) {
    post.totalTransfers = post.totalTransfers.plus(BigInt.fromI32(1))
    post.save()

    // Update content coin stats
    let contentCoin = ContentCoin.load(event.address)
    if (contentCoin) {
      contentCoin.totalTransfers = contentCoin.totalTransfers.plus(BigInt.fromI32(1))
      contentCoin.save()
    }

  }
}

// Handle ContentCoin Mint events (new likes)
export function handleContentCoinMint(event: ContentCoinMint): void {
  log.info("ContentCoin Mint: to={}, amount={}", [
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
  let post = Post.load(event.address)
  if (post) {
    post.totalMints = post.totalMints.plus(BigInt.fromI32(1))
    post.totalSupply = post.totalSupply.plus(event.params.amount)
    post.totalHolders = post.totalHolders.plus(BigInt.fromI32(1))
    post.save()

    // Update content coin stats
    let contentCoin = ContentCoin.load(event.address)
    if (contentCoin) {
      contentCoin.totalMints = contentCoin.totalMints.plus(BigInt.fromI32(1))
      contentCoin.totalSupply = contentCoin.totalSupply.plus(event.params.amount)
      contentCoin.save()
    }


  }
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

  // Update user stats
  if (event.params.from != event.params.to) {
    fromUser.totalTransfers = fromUser.totalTransfers.plus(BigInt.fromI32(1))
    toUser.totalTransfers = toUser.totalTransfers.plus(BigInt.fromI32(1))
  }
  fromUser.save()
  toUser.save()

  // Create transfer entity
  let transferId = createId("creator-", event.transaction.hash, event.logIndex)
  let transfer = new Transfer(transferId)
  transfer.post = Bytes.fromHexString("0x0000000000000000000000000000000000000000") // CreatorCoin as special post
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.amount = event.params.value
  transfer.timestamp = event.block.timestamp
  transfer.blockNumber = event.block.number
  transfer.transactionHash = event.transaction.hash
  transfer.save()

  // Update creator coin stats
  let creatorCoin = CreatorCoin.load(event.address)
  if (creatorCoin) {
    creatorCoin.totalSupply = creatorCoin.totalSupply.plus(event.params.value)
    creatorCoin.totalHolders = creatorCoin.totalHolders.plus(BigInt.fromI32(1))
    creatorCoin.save()
  }
}
