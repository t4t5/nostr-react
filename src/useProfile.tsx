import { atom, useAtom } from "jotai"
import { nip19 } from "nostr-tools"
import { useEffect, useState } from "react"

import { useNostrEvents } from "./core"
import { uniqValues } from "./utils"

interface Metadata {
  name?: string
  display_name?: string
  picture?: string
  about?: string
  website?: string
  lud06?: string
  lud16?: string
  nip06?: string
}

const QUEUE_DEBOUNCE_DURATION = 100

let timer: NodeJS.Timeout | undefined = undefined

const queuedPubkeysAtom = atom<string[]>([])
const requestedPubkeysAtom = atom<string[]>([])
const fetchedProfilesAtom = atom<Record<string, Metadata>>({})

function useProfileQueue({ pubkey }: { pubkey: string }) {
  const [isReadyToFetch, setIsReadyToFetch] = useState(false)

  const [queuedPubkeys, setQueuedPubkeys] = useAtom(queuedPubkeysAtom)

  const [requestedPubkeys] = useAtom(requestedPubkeysAtom)
  const alreadyRequested = !!requestedPubkeys.includes(pubkey)

  useEffect(() => {
    if (alreadyRequested) {
      return
    }

    clearTimeout(timer)

    timer = setTimeout(() => {
      setIsReadyToFetch(true)
    }, QUEUE_DEBOUNCE_DURATION)

    setQueuedPubkeys((_pubkeys: string[]) => {
      // Unique values only:
      const arr = [..._pubkeys, pubkey].filter(uniqValues).filter((_pubkey) => {
        return !requestedPubkeys.includes(_pubkey)
      })

      return arr
    })
  }, [pubkey, setQueuedPubkeys, alreadyRequested, requestedPubkeys])

  return {
    pubkeysToFetch: isReadyToFetch ? queuedPubkeys : [],
  }
}

export function useProfile({ pubkey }: { pubkey: string }) {
  const [, setRequestedPubkeys] = useAtom(requestedPubkeysAtom)
  const { pubkeysToFetch } = useProfileQueue({ pubkey })
  const enabled = !!pubkeysToFetch.length

  const [fetchedProfiles, setFetchedProfiles] = useAtom(fetchedProfilesAtom)

  const { onEvent, onSubscribe, isLoading } = useNostrEvents({
    filter: {
      kinds: [0],
      authors: pubkeysToFetch,
    },
    enabled,
  })

  onSubscribe(() => {
    // Reset list
    // (We've already opened a subscription to these pubkeys now)
    setRequestedPubkeys((_pubkeys) => {
      return [..._pubkeys, ...pubkeysToFetch].filter(uniqValues)
    })
  })

  onEvent((rawMetadata) => {
    try {
      const metadata: Metadata = JSON.parse(rawMetadata.content)
      const metaPubkey = rawMetadata.pubkey

      if (metadata) {
        setFetchedProfiles((_profiles: Record<string, Metadata>) => {
          return {
            ..._profiles,
            [metaPubkey]: metadata,
          }
        })
      }
    } catch (err) {
      console.error(err, rawMetadata)
    }
  })

  const metadata = fetchedProfiles[pubkey]
  const npub = nip19.npubEncode(pubkey)

  return {
    isLoading,
    data: metadata
      ? {
          ...metadata,
          npub,
        }
      : undefined,
  }
}
