// Zora Social Network Subgraph Mapping
// Following all 6 Graph Best Practices based on Zora Coins Architecture

import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import {
  CoinCreated
} from "../generated/ZoraFactoryImpl/ZoraFactoryImpl"
import {
  Transfer,
  Mint
} from "../generated/ContentCoin/ContentCoin"
import { 
  Post, 
  User, 
  CreatorCoin,
  Mint as MintEntity, 
  Transfer as TransferEntity,
  Swap,
  Reward,
  PostMetrics,
  VestingSchedule
} from "../generated/schema"

// Best Practice 4: Avoid eth_calls - use event data only
export function handleCoinCreated(event: CoinCreated): void {
  // Create post entity (ContentCoin) - immutable
  let post = new Post(event.params.coin)
  post.creator = event.params.caller
  post.name = event.params.name
  post.symbol = event.params.symbol
  post.contentURI = event.params.uri
  post.createdAt = event.block.timestamp
  post.blockNumber = event.block.number
  post.transactionHash = event.transaction.hash
  post.totalSupply = BigInt.fromI32(0)
  post.totalMints = BigInt.fromI32(0)
  post.totalTransfers = BigInt.fromI32(0)
  post.totalSwaps = BigInt.fromI32(0)
  post.save()

  // Create or update user
  let user = User.load(event.params.caller)
  if (user == null) {
    user = new User(event.params.caller)
    user.totalPosts = BigInt.fromI32(0)
    user.totalMints = BigInt.fromI32(0)
    user.totalSwaps = BigInt.fromI32(0)
    user.totalRewards = BigInt.fromI32(0)
  }
  user.totalPosts = user.totalPosts.plus(BigInt.fromI32(1))
  user.save()

  // Link to creator coin (if exists)
  let creatorCoin = CreatorCoin.load(event.params.caller)
  if (creatorCoin != null) {
    post.creatorCoin = creatorCoin.id
    post.save()
  }

  // Create initial metrics (Best Practice 5: Timeseries)
  let metrics = new PostMetrics(event.block.timestamp.toI32())
  metrics.post = event.params.coin
  metrics.totalMints = BigInt.fromI32(0)
  metrics.totalTransfers = BigInt.fromI32(0)
  metrics.totalSwaps = BigInt.fromI32(0)
  metrics.save()
}

export function handleTransfer(event: Transfer): void {
  // Check if this is a ContentCoin transfer
  let post = Post.load(event.address)
  if (post == null) {
    return // Not a ContentCoin contract
  }

  // Create transfer entity (immutable)
  let transfer = new TransferEntity(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  transfer.post = post.id
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.amount = event.params.value
  transfer.timestamp = event.block.timestamp
  transfer.blockNumber = event.block.number
  transfer.transactionHash = event.transaction.hash
  transfer.save()

  // Update post metrics
  post.totalTransfers = post.totalTransfers.plus(BigInt.fromI32(1))
  post.save()

  // Update user stats
  let fromUser = User.load(event.params.from)
  if (fromUser != null) {
    fromUser.totalSwaps = fromUser.totalSwaps.plus(BigInt.fromI32(1))
    fromUser.save()
  }

  let toUser = User.load(event.params.to)
  if (toUser == null) {
    toUser = new User(event.params.to)
    toUser.totalPosts = BigInt.fromI32(0)
    toUser.totalMints = BigInt.fromI32(0)
    toUser.totalSwaps = BigInt.fromI32(0)
    toUser.totalRewards = BigInt.fromI32(0)
  }
  toUser.totalSwaps = toUser.totalSwaps.plus(BigInt.fromI32(1))
  toUser.save()

  // Update timeseries metrics (Best Practice 5)
  let metrics = new PostMetrics(event.block.timestamp.toI32())
  metrics.post = post.id
  metrics.totalMints = post.totalMints
  metrics.totalTransfers = post.totalTransfers
  metrics.totalSwaps = post.totalSwaps
  metrics.save()
}

export function handleMint(event: Mint): void {
  // Check if this is a ContentCoin mint
  let post = Post.load(event.address)
  if (post == null) {
    return // Not a ContentCoin contract
  }

  // Create mint entity (immutable)
  let mint = new MintEntity(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  mint.post = post.id
  mint.minter = event.params.to
  mint.amount = event.params.amount
  mint.timestamp = event.block.timestamp
  mint.blockNumber = event.block.number
  mint.transactionHash = event.transaction.hash
  mint.save()

  // Update post metrics
  post.totalMints = post.totalMints.plus(BigInt.fromI32(1))
  post.totalSupply = post.totalSupply.plus(event.params.amount)
  post.save()

  // Update user stats
  let minter = User.load(event.params.to)
  if (minter == null) {
    minter = new User(event.params.to)
    minter.totalPosts = BigInt.fromI32(0)
    minter.totalMints = BigInt.fromI32(0)
    minter.totalSwaps = BigInt.fromI32(0)
    minter.totalRewards = BigInt.fromI32(0)
  }
  minter.totalMints = minter.totalMints.plus(BigInt.fromI32(1))
  minter.save()

  // Update timeseries metrics (Best Practice 5)
  let metrics = new PostMetrics(event.block.timestamp.toI32())
  metrics.post = post.id
  metrics.totalMints = post.totalMints
  metrics.totalTransfers = post.totalTransfers
  metrics.totalSwaps = post.totalSwaps
  metrics.save()
}

export function handleCreatorCoinTransfer(event: Transfer): void {
  // Check if this is a CreatorCoin transfer
  let creatorCoin = CreatorCoin.load(event.address)
  if (creatorCoin == null) {
    return // Not a CreatorCoin contract
  }

  // Create transfer entity (immutable)
  let transfer = new TransferEntity(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  transfer.creatorCoin = creatorCoin.id
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.amount = event.params.value
  transfer.timestamp = event.block.timestamp
  transfer.blockNumber = event.block.number
  transfer.transactionHash = event.transaction.hash
  transfer.save()

  // Update user stats
  let fromUser = User.load(event.params.from)
  if (fromUser != null) {
    fromUser.totalSwaps = fromUser.totalSwaps.plus(BigInt.fromI32(1))
    fromUser.save()
  }

  let toUser = User.load(event.params.to)
  if (toUser == null) {
    toUser = new User(event.params.to)
    toUser.totalPosts = BigInt.fromI32(0)
    toUser.totalMints = BigInt.fromI32(0)
    toUser.totalSwaps = BigInt.fromI32(0)
    toUser.totalRewards = BigInt.fromI32(0)
  }
  toUser.totalSwaps = toUser.totalSwaps.plus(BigInt.fromI32(1))
  toUser.save()
}

// Helper function to create unique IDs (Best Practice 3)
function createEventId(event: ethereum.Event): Bytes {
  return event.transaction.hash.concatI32(event.logIndex.toI32())
}
