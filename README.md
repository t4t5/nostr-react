# @nostrgg/react

React Hooks for Nostr

## Installation

```
npm install @nostrgg/react
```

## Example usage:

Wrap your app in the NostrProvider:

```tsx
import { NostrProvider } from "@nostrgg/react";

const relayUrls = [
  "wss://nostr-pub.wellorder.net",
  "wss://nostr-relay.untethr.me",
];

function MyApp() {
  return (
    <NostrProvider relayUrls={relayUrls}>
      <App />
    </NostrProvider>
  );
};
```

You can now use the `useNostr` and `useNostrEvents` hooks in your components!

**Fetching all `text_note` events starting now:**

```tsx
import { Kind, useNostrEvents, dateToUnix } from "@nostrgg/react";

const GlobalFeed = () => {
  const { isLoading, events } = useNostrEvents({
    filter: {
      kinds: [Kind.TextNote],
      since: dateToUnix(new Date()), // all new events from now
    },
  });

  return (
    <>
      {events.map((event) => (
        <p key={event.id}>{event.pubkey} posted: {event.content}</p>
      ))}
    </>
  );
};
```

**Fetching all `text_note` events from a specific user, since the beginning of time:**

```tsx
import { Kind, useNostrEvents, dateToUnix } from "@nostrgg/react";

const ProfileFeed = () => {
  const { events } = useNostrEvents({
    filter: {
      authors: [
        "9c2a6495b4e3de93f3e1cc254abe4078e17c64e5771abc676a5e205b62b1286c",
      ],
      since: 0,
      kinds: [Kind.TextNote],
    },
  });

  return (
    <>
      {events.map((event) => (
        <p key={event.id}>{event.pubkey} posted: {event.content}</p>
      ))}
    </>
  );
};
```

**Post a message:**

```tsx
import {
  generateSignedEvent,
  Kind,
  SendMsgType,
  useNostr,
} from "@nostrgg/react";

export default function PostButton() {
  const { sendEvent } = useNostr();

  const onPost = async () => {
    const privKey = prompt("Paste your private key here:");

    if (!privKey) {
      alert("no private key provided");
      return;
    }

    const event = {
      content: "Hello world!",
      kind: Kind.TextNote,
      tags: [],
    };

    const signedEvent = await generateSignedEvent(event, privKey);

    sendEvent?.([SendMsgType.EVENT, signedEvent]);
  };

  return (
    <Button onClick={onPost}>Post a message!</Button>
  );
}
```
