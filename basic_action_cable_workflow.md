# Basic Action Cable Workflow

To start:

1. If you created your Rails project using the `--api` flag, then `npm install
   @rails/actioncable` in your __frontend__ folder. (Don't use the `--minimal`
   flag when creating the Rails project.)
2. Add a __consumer.js__ file in your __frontend/src__ folder. Inside the file,
   import `createConsumer` from `@rails/actioncable` and export it as the
   default, passing in the connection URL as an argument (`'/cable'`, if you're
   using the default).

   **Note:** Because Chrome has issues using WebSockets through proxies, specify
   the absolute URL in `development` (e.g., `ws://localhost:5000/cable`).

3. Define a `connect` method in __app/channels/application_cable/connection.rb__
   that assigns `self.current_user`. Add `identified_by :current_user` at the
   top of the `Connection` class.

Then, for each real-time feature of your app:

1. Create a channel file in __app/channels__, defining a class that inherits
    from `ApplicationCable::Channel`.
    - At the very least, define a `subscribed` method, using
      `stream_for(model)` or `stream_from(string)` to connect the
      subscribing user to a stream.
2. In the relevant frontend component:
    - Import `consumer`.
    - Create a subscription in a `useEffect` using
      `consumer.subscription.create()`:
        - *First argument*: an object with a `channel` property and any params
          your `subscribed` method on the backend needs
        - *Second argument*: an object with a `received` property, pointing to a
          callback that gets invoked for each broadcast of the subscription's
          stream
    - Return a clean-up function that unsubscribes from the subscription.
3. In your backend controllers and/or channels, broadcast data to a stream by
   calling:
    - `SomeChannel.broadcast_to(model, data)`, if you used `stream_for`
    - `ActionCable.server.broadcast(stream_name, data)`, if you used
      `stream_from`