import {SubscriptionClient} from "subscriptions-transport-ws";
import {HASURA_WS_URL} from "./constants";
import {WebSocketLink} from "@apollo/link-ws";
import {ApolloClient, from, InMemoryCache} from "@apollo/client";

export function createWebsocketClient(getTokens: () => Promise<string | undefined>) {
  const subscriptionClient = new SubscriptionClient(HASURA_WS_URL, {
    reconnect: true,
    reconnectionAttempts: 5,
    lazy: true,
    timeout: 8000,
    connectionParams: async () => {
      const accToken = await getTokens();
      return {
        headers: {
          authorization: `Bearer ${accToken}`,
          'x-hasura-role': 'admin',
        }
      };
    },
    inactivityTimeout: 10000,
    connectionCallback: (error: Error[]) => {
      if (error) {
        console.log('connectionCallback:', error);
      }
      console.log('connectionCallback');
    },
  });

// on subscription error, refresh subscription (close and reconnect)
  subscriptionClient.onError((error) => {
    console.log('subscriptionClient.onError:', error);
    subscriptionClient.close(false, false);
  })

  subscriptionClient.onConnected(() => {
    console.log('Connected');
  });

  subscriptionClient.onDisconnected(() => {
    console.log('Disconnected');
  });

  subscriptionClient.onReconnected(() => {
    console.log('Reconnected');
  });

  subscriptionClient.onReconnecting(() => {
    console.log('Reconnecting');
  });

  const wsLink = new WebSocketLink(
    subscriptionClient
  );

  const client = new ApolloClient({
    link: from([wsLink]),
    cache: new InMemoryCache(),
  });
  return client;
}
