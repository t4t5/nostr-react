import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

import { Relay, Filter, Event as NostrEvent, relayInit } from "nostr-tools"

import { uniqBy } from "./utils"

type OnConnectFunc = (relay: Relay) => void

interface NostrContextType {
  isLoading: boolean
  debug?: boolean
  onConnect: (_onConnectCallback?: OnConnectFunc) => void
}

const NostrContext = createContext<NostrContextType>({
  isLoading: true,
  onConnect: () => null,
})

const log = (
  isOn: boolean | undefined,
  type: "info" | "error" | "warn",
  ...args: unknown[]
) => {
  if (!isOn) return
  console[type](...args)
}

export function NostrProvider({
  children,
  relayUrls,
  debug,
}: {
  children: ReactNode
  relayUrls: string[]
  debug?: boolean
}) {
  const [isLoading, setIsLoading] = useState(true)

  let onConnectCallback: null | OnConnectFunc = null

  useEffect(() => {
    relayUrls.forEach(async (relayUrl) => {
      const relay = relayInit(relayUrl)
      relay.connect()

      relay.on("connect", () => {
        log(debug, "info", `✅ nostr: Connected to ${relayUrl}`)
        setIsLoading(false)
        onConnectCallback?.(relay)
      })

      // Wait for this to be merged: https://github.com/fiatjaf/nostr-tools/pull/69
      // relay.on("error", () => {
      //   log(debug, "error", `❌ nostr: Error connecting to ${relayUrl}!`)
      //   console.log(`Error connecting to ${relay.url}`)
      // })
    })
  }, [onConnectCallback, relayUrls])

  const value: NostrContextType = {
    debug,
    isLoading,
    onConnect: (_onConnectCallback?: OnConnectFunc) => {
      if (_onConnectCallback) {
        onConnectCallback = _onConnectCallback
      }
    },
  }

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
}

export function useNostr() {
  return useContext(NostrContext)
}

export function useNostrEvents({ filter }: { filter: Filter }) {
  const { isLoading, onConnect, debug } = useNostr()
  const [events, setEvents] = useState<NostrEvent[]>([])

  onConnect((relay: Relay) => {
    const sub = relay.sub([filter], {})

    sub.on("event", (event: NostrEvent) => {
      log(debug, "info", "⬇️ nostr: Received event:", event)
      setEvents((_events) => {
        return [event, ..._events]
      })
    })
  })

  const uniqEvents = events.length > 0 ? uniqBy(events, "id") : []
  const sortedEvents = uniqEvents.sort((a, b) => b.created_at - a.created_at)

  return {
    isLoading,
    events: sortedEvents,
    onConnect,
  }
}
