<p align="center">
<b>nostr-react</b>
</p>
<p align="center">
React Hooks for Nostr ✨
</p>

## Installation

```
npm install nostr-react
```

## Example usage:

Wrap your app in the NostrProvider:

```tsx
import { NostrProvider } from "nostr-react";

const relayUrls = [
  "wss://nostr-pub.wellorder.net",
  "wss://nostr-relay.untethr.me",
];

function MyApp() {
  return (
    <NostrProvider relayUrls={relayUrls} debug>
      <App />
    </NostrProvider>
  );
};
```

You can now use the `useNostr` and `useNostrEvents` hooks in your components!

**Fetching all `text_note` events starting now:**

```tsx
import { useNostrEvents, dateToUnix } from "nostr-react";

const GlobalFeed = () => {
  const { isLoading, events } = useNostrEvents({
    filter: {
      kinds: [1],
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
import { useNostrEvents } from "nostr-react";

const ProfileFeed = () => {
  const { events } = useNostrEvents({
    filter: {
      authors: [
        "9c2a6495b4e3de93f3e1cc254abe4078e17c64e5771abc676a5e205b62b1286c",
      ],
      since: 0,
      kinds: [1],
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
import { useNostr, dateToUnix } from "nostr-react";

import {
  type Event as NostrEvent,
  getEventHash,
  getPublicKey,
  signEvent,
} from "nostr-tools";

export default function PostButton() {
  const { publish } = useNostr();

  const onPost = async () => {
    const privKey = prompt("Paste your private key:");

    if (!privKey) {
      alert("no private key provided");
      return;
    }

    const message = prompt("Enter the message you want to send:");

    if (!message) {
      alert("no message provided");
      return;
    }

    const event: NostrEvent = {
      content: message,
      kind: 1,
      tags: [],
      created_at: dateToUnix(),
      pubkey: getPublicKey(privKey),
    };

    event.id = getEventHash(event);
    event.sig = signEvent(event, privKey);

    publish(event);
  };

  return (
    <Button onClick={onPost}>Post a message!</Button>
  );
}
```
