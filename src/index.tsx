import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

import { Relay, Filter, Event as NostrEvent, relayInit } from "nostr-tools"

import { uniqBy } from "./utils"
export { dateToUnix } from "./utils"

type OnConnectFunc = (relay: Relay) => void
type OnDisconnectFunc = (relay: Relay) => void
type OnEventFunc = (event: NostrEvent) => void

interface NostrContextType {
  isLoading: boolean
  debug?: boolean
  connectedRelays: Relay[]
  onConnect: (_onConnectCallback?: OnConnectFunc) => void
  onDisconnect: (_onDisconnectCallback?: OnDisconnectFunc) => void
  publish: (event: NostrEvent) => void
}

const NostrContext = createContext<NostrContextType>({
  isLoading: true,
  connectedRelays: [],
  onConnect: () => null,
  onDisconnect: () => null,
  publish: () => null,
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
  const [connectedRelays, setConnectedRelays] = useState<Relay[]>([])

  const publish = (event: NostrEvent) => {
    log(debug, "info", "⬆️ nostr: Sending event:", event)

    return connectedRelays.map((relay) => {
      return relay.publish(event)
    })
  }

  let onConnectCallback: null | OnConnectFunc = null
  let onDisconnectCallback: null | OnDisconnectFunc = null

  useEffect(() => {
    let ignore = false // For React StrictMode

    relayUrls.forEach(async (relayUrl) => {
      const relay = relayInit(relayUrl)
      relay.connect()

      relay.on("connect", () => {
        if (ignore) return

        log(debug, "info", `✅ nostr: Connected to ${relayUrl}`)
        setIsLoading(false)
        onConnectCallback?.(relay)
        setConnectedRelays((prev) => uniqBy([...prev, relay], "url"))
      })

      relay.on("disconnect", () => {
        log(debug, "warn", `🚪 nostr: Connection closed for ${relayUrl}`)
        onDisconnectCallback?.(relay)
        setConnectedRelays((prev) => prev.filter((r) => r.url !== relayUrl))
      })

      relay.on("error", () => {
        log(debug, "error", `❌ nostr: Error connecting to ${relayUrl}!`)
      })
    })

    return () => {
      ignore = true
    }
  }, [])

  const value: NostrContextType = {
    debug,
    isLoading,
    connectedRelays,
    publish,
    onConnect: (_onConnectCallback?: OnConnectFunc) => {
      if (_onConnectCallback) {
        onConnectCallback = _onConnectCallback
      }
    },
    onDisconnect: (_onDisconnectCallback?: OnDisconnectFunc) => {
      if (_onDisconnectCallback) {
        onDisconnectCallback = _onDisconnectCallback
      }
    },
  }

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
}

export function useNostr() {
  return useContext(NostrContext)
}

export function useNostrEvents({ filter }: { filter: Filter }) {
  const { isLoading, onConnect, debug, connectedRelays } = useNostr()
  const [events, setEvents] = useState<NostrEvent[]>([])
  const [unsubscribe, setUnsubscribe] = useState(() => {
    return
  })

  let onEventCallback: null | OnEventFunc = null

  // Lets us set filterBase64 as a useEffect dependency
  const filterBase64 =
    typeof window !== "undefined" ? window.btoa(JSON.stringify(filter)) : null

  const subscribe = (relay: Relay) => {
    log(debug, "info", "⬆️ nostr: Subscribing to filter:", filter)
    const sub = relay.sub([filter])

    const unsubscribeFunc = () => {
      log(debug, "info", "🚪 nostr: Unsubscribing from filter:", filter)
      return sub.unsub()
    }

    setUnsubscribe(() => unsubscribeFunc)

    sub.on("event", (event: NostrEvent) => {
      log(debug, "info", "⬇️ nostr: Received event:", event)
      onEventCallback?.(event)
      setEvents((_events) => {
        return [event, ..._events]
      })
    })
  }

  useEffect(() => {
    connectedRelays.forEach((relay) => {
      subscribe(relay)
    })
  }, [connectedRelays, filterBase64])

  const uniqEvents = events.length > 0 ? uniqBy(events, "id") : []
  const sortedEvents = uniqEvents.sort((a, b) => b.created_at - a.created_at)

  return {
    isLoading,
    events: sortedEvents,
    onConnect,
    connectedRelays,
    unsubscribe,
    onEvent: (_onEventCallback: OnEventFunc) => {
      if (_onEventCallback) {
        onEventCallback = _onEventCallback
      }
    },
  }
}
