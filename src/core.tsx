import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import { Relay, Filter, Event as NostrEvent, relayInit, Sub } from "nostr-tools"

import { uniqBy } from "./utils"

type OnConnectFunc = (relay: Relay) => void
type OnDisconnectFunc = (relay: Relay) => void
type OnEventFunc = (event: NostrEvent) => void
type OnDoneFunc = () => void
type OnSubscribeFunc = (sub: Sub, relay: Relay) => void

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

  let onConnectCallback: null | OnConnectFunc = null
  let onDisconnectCallback: null | OnDisconnectFunc = null

  const isFirstRender = useRef(true)

  const connectToRelays = useCallback(() => {
    relayUrls.forEach(async (relayUrl) => {
      const relay = relayInit(relayUrl)
      relay.connect()

      relay.on("connect", () => {
        log(debug, "info", `✅ nostr (${relayUrl}): Connected!`)
        setIsLoading(false)
        onConnectCallback?.(relay)
        setConnectedRelays((prev) => uniqBy([...prev, relay], "url"))
      })

      relay.on("disconnect", () => {
        log(debug, "warn", `🚪 nostr (${relayUrl}): Connection closed.`)
        onDisconnectCallback?.(relay)
        setConnectedRelays((prev) => prev.filter((r) => r.url !== relayUrl))
      })

      relay.on("error", () => {
        log(debug, "error", `❌ nostr (${relayUrl}): Connection error!`)
      })
    })
  }, [debug, onConnectCallback, onDisconnectCallback, relayUrls])

  useEffect(() => {
    // Make sure we only start the relays once (even in strict-mode)
    if (isFirstRender.current) {
      isFirstRender.current = false
      connectToRelays()
    }
  }, [connectToRelays])

  const publish = (event: NostrEvent) => {
    return connectedRelays.map((relay) => {
      log(debug, "info", `⬆️ nostr (${relay.url}): Sending event:`, event)

      return relay.publish(event)
    })
  }

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

export function useNostrEvents({
  filter,
  enabled = true,
}: {
  filter: Filter
  enabled?: boolean
}) {
  const {
    isLoading: isLoadingProvider,
    onConnect,
    debug,
    connectedRelays,
  } = useNostr()

  const [isLoading, setIsLoading] = useState(true)
  const [events, setEvents] = useState<NostrEvent[]>([])
  const [unsubscribe, setUnsubscribe] = useState<() => void | void>(() => {
    return
  })

  let onEventCallback: null | OnEventFunc = null
  let onSubscribeCallback: null | OnSubscribeFunc = null
  let onDoneCallback: null | OnDoneFunc = null

  // Lets us detect changes in the nested filter object for the useEffect hook
  const filterBase64 =
    typeof window !== "undefined" ? window.btoa(JSON.stringify(filter)) : null

  const _unsubscribe = (sub: Sub, relay: Relay) => {
    log(
      debug,
      "info",
      `🙉 nostr (${relay.url}): Unsubscribing from filter:`,
      filter,
    )
    return sub.unsub()
  }

  const subscribe = useCallback((relay: Relay, filter: Filter) => {
    log(
      debug,
      "info",
      `👂 nostr (${relay.url}): Subscribing to filter:`,
      filter,
    )
    const sub = relay.sub([filter])

    setIsLoading(true)

    const unsubscribeFunc = () => {
      _unsubscribe(sub, relay)
    }

    setUnsubscribe(() => unsubscribeFunc)

    sub.on("event", (event: NostrEvent) => {
      log(debug, "info", `⬇️ nostr (${relay.url}): Received event:`, event)
      onEventCallback?.(event)
      setEvents((_events) => {
        return [event, ..._events]
      })
    })

    sub.on("eose", () => {
      setIsLoading(false)
      onDoneCallback?.()
    })

    return sub
  }, [])

  useEffect(() => {
    if (!enabled) return

    const relaySubs = connectedRelays.map((relay) => {
      const sub = subscribe(relay, filter)

      onSubscribeCallback?.(sub, relay)

      return {
        sub,
        relay,
      }
    })

    return () => {
      relaySubs.forEach(({ sub, relay }) => {
        _unsubscribe(sub, relay)
      })
    }
  }, [connectedRelays, filterBase64, enabled])

  const uniqEvents = events.length > 0 ? uniqBy(events, "id") : []
  const sortedEvents = uniqEvents.sort((a, b) => b.created_at - a.created_at)

  return {
    isLoading: isLoading || isLoadingProvider,
    events: sortedEvents,
    onConnect,
    connectedRelays,
    unsubscribe,
    onSubscribe: (_onSubscribeCallback: OnSubscribeFunc) => {
      if (_onSubscribeCallback) {
        onSubscribeCallback = _onSubscribeCallback
      }
    },
    onEvent: (_onEventCallback: OnEventFunc) => {
      if (_onEventCallback) {
        onEventCallback = _onEventCallback
      }
    },
    onDone: (_onDoneCallback: OnDoneFunc) => {
      if (_onDoneCallback) {
        onDoneCallback = _onDoneCallback
      }
    },
  }
}
