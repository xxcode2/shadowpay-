import prisma from '../lib/prisma.js'
import { privacyCash } from './privacyCash.js'

export async function claimPaymentLink(params: {
  linkId: string
  recipient: string
}) {
  const { linkId, recipient } = params

  return await prisma.$transaction(async (txDb) => {
    // 1. Atomic lock: mark claimed ONLY if not claimed yet
    const locked = await txDb.paymentLink.updateMany({
      where: {
        id: linkId,
        claimed: false,
      },
      data: {
        claimed: true,
        claimedBy: recipient,
      },
    })

    // If no row updated → already claimed or not found
    if (locked.count !== 1) {
      throw new Error('Link already claimed or invalid')
    }

    // 2. Fetch locked link (now guaranteed single owner)
    const link = await txDb.paymentLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      throw new Error('Link not found after lock')
    }

    // 3. Execute Privacy Cash withdraw (ONE TIME)
    let withdrawTx: string
    try {
      const result = await privacyCash.withdraw({
        commitment: link.commitment,
        recipient,
      })
      withdrawTx = typeof result === 'string' ? result : result.tx
    } catch (err) {
      // 4. Rollback lock if withdraw fails
      await txDb.paymentLink.update({
        where: { id: linkId },
        data: {
          claimed: false,
          claimedBy: null,
        },
      })

      throw new Error('Withdraw failed')
    }

    // 5. Persist withdraw tx
    await txDb.paymentLink.update({
      where: { id: linkId },
      data: {
        withdrawTx,
      },
    })

    return { withdrawTx }
  })
}
