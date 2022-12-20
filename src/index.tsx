import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react"

import { uniqBy } from "./utils"

import {
  OnConnectFunc,
  initNostr,
  OnEventFunc,
  SendEventFunc,
  Filter,
  NostrEvent,
  SendMsgType,
  SendEvent,
} from "@nostrgg/client"

export * from "@nostrgg/client"

interface NostrContextType {
  isLoading: boolean
  onConnect: (_onConnectCallback?: OnConnectFunc) => void
  onEvent: (_onEventCallback?: OnEventFunc) => void
  sendEvent?: (event: SendEvent) => void
}

const NostrContext = createContext<NostrContextType>({
  isLoading: true,
  onConnect: () => null,
  onEvent: () => null,
})

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
  let onEventCallback: null | OnEventFunc = null

  const sendEventRef = useRef<SendEventFunc>()

  useEffect(() => {
    const { sendEvent: _sendEvent } = initNostr({
      relayUrls,
      onConnect: (url, sendEvent) => {
        setIsLoading(false)

        if (onConnectCallback) {
          onConnectCallback(url, sendEvent)
        }
      },
      onEvent: (relayUrl, event) => {
        if (onEventCallback) {
          onEventCallback(relayUrl, event)
        }
      },
      debug,
    })

    sendEventRef.current = _sendEvent
  }, [onConnectCallback, onEventCallback, relayUrls])

  const value: NostrContextType = {
    isLoading,
    sendEvent: sendEventRef.current,
    onConnect: (_onConnectCallback?: OnConnectFunc) => {
      if (_onConnectCallback) {
        onConnectCallback = _onConnectCallback
      }
    },
    onEvent: (_onEventCallback?: OnEventFunc) => {
      if (_onEventCallback) {
        onEventCallback = _onEventCallback
      }
    },
  }

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
}

export function useNostr() {
  return useContext(NostrContext)
}

export function useNostrEvents({ filter }: { filter: Filter }) {
  const { isLoading, sendEvent, onConnect, onEvent } = useNostr()
  const [events, setEvents] = useState<NostrEvent[]>([])

  onConnect((url, _sendEvent) => {
    _sendEvent([SendMsgType.REQ, filter], url)
  })

  onEvent((_relayUrl, event) => {
    setEvents((_events) => {
      return [event, ..._events]
    })
  })

  const uniqEvents = events.length > 0 ? uniqBy(events, "id") : []
  const sortedEvents = uniqEvents.sort((a, b) => b.created_at - a.created_at)

  return {
    isLoading,
    events: sortedEvents,
    onConnect,
    onEvent,
    sendEvent,
  }
}
