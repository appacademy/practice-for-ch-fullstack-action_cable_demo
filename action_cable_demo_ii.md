# Action Cable Demo: Part II

The next two features explore some more advanced ways of using Action Cable:
broadcasting from channels, persisting data in connection instances, and sending
messages from a subscriber to a channel.

## Showing `User`s in a `Room`

1. **(Backend)** Broadcast when a user enters and leaves a room:

   ```rb
   # app/channels/rooms_channel.rb

   def subscribed
     @room = Room.find_by(id: params[:id])
     stream_for @room

     # Add these lines to broadcast entering a room:
     self.class.broadcast_to @room, 
       type: 'RECEIVE_USER',
       user: current_user.slice(:id, :username)
   end

   # Define an `unsubscribed` callback method, to broadcast leaving a room
   def unsubscribed
     self.class.broadcast_to @room, 
       type: 'REMOVE_USER',
       id: current_user.id
   end
   ```

   Just as `subscribed` gets called automatically when a client calls
   `consumer.subscriptions.create()`, `unsubscribed` gets called when a client
   calls `subscription.unsubscribe()`.

2. **(Frontend)** Handle entering & leaving broadcasts in the `Room` component:

   ```js
   // frontend/src/components/Room.js

   const subscription = consumer.subscriptions.create(
     { channel: 'RoomsChannel', id: roomId },
     {
       received: ({ type, message, user, id }) => {
         switch (type) {
           // ...other cases...
           // Add the following two cases:
           case 'RECEIVE_USER':
             setUsersInRoom(prevUsersInRoom => ({ ...prevUsersInRoom, [user.id]: user }));
             break;
           case 'REMOVE_USER':
             setUsersInRoom(prevUsersInRoom => {
               const { [id]: _removed, ...remainingUsers } = prevUsersInRoom;
               return remainingUsers;
             });
             break;
           default:
             console.log('Unhandled broadcast: ', type);
             break;
         }
       }
     }
   );
   ```

   Whenever a user enters or leaves a room, the `usersInRoom` property of the
   component state gets updated accordingly. Go ahead and test this out: after
   refreshing both browsers, keep Garfield in "Garfield's First Room", and have
   Sennacy move in and out of the room. You should see Sennacy's username appear
   and disappear on Garfield's screen from the list of users in the room.

   This is pretty great, but when Sennacy enters the room, they don't see
   Garfield is already there. They weren't subscribed when Garfield first
   entered the room. Is there a way to retrieve, upon entering a room, a list of
   all users currently subscribed to that room? There is, with a bit of work.

3. **(Backend)** Persist a list of rooms each user is subscribed to in an
   `@rooms` instance variable defined for each `ActionCable::Connection`
   instance. Then, to get a list of users subscribed to a room, filter all
   active connections for those whose `@rooms` includes the given room.

   Each online user has a corresponding connection instance. The first step,
   then, is to persist a list of rooms each user is subscribed to as an instance
   variable, `@rooms`, of this connection. To do so, you'll define a `rooms`
   getter in `ActionCable::Connection`, which lazily initializes `@rooms` to an
   empty array.

   ```rb
   # app/channels/application_cable/connection.rb

   # Add :rooms as an identifier so you can access directly from channels
   identified_by :current_user, :rooms

   def current_user
     @current_user ||= User.find_by(session_token: request.session[:session_token])
   end

   # Add this @rooms getter
   def rooms
     @rooms ||= []
   end
   ```

   Next, you'll keep `@rooms` up to date by adding and removing rooms in the
   `subscribed` and `unsubscribed` methods of `RoomsChannel`:

   ```rb
   # app/channels/rooms_channel.rb

     def subscribed
       @room = Room.find_by(id: params[:id])
       # Add this line to add current room to list of rooms user is in
       rooms << @room 
       stream_for @room

       self.class.broadcast_to @room, 
         type: 'RECEIVE_USER',
         user: current_user.slice(:id, :username)
     end

     def unsubscribed
       # Add this line to remove current room from list of room user is in
       rooms.delete(@room)

       self.class.broadcast_to @room, 
         type: 'REMOVE_USER',
         id: current_user.id
     end
   ```

  Finally, you'll define `RoomsChannel::online_users`, which takes a room
  instance, filters all active connections to only include those whose `@rooms`
  array include the provided `room`, then maps those connections to the users
  associated with them:

  ```rb
  #app/channels/rooms_channel.rb

  def self.online_users(room)
    ActionCable.server.connections.filter_map do |conn| 
      conn.rooms.include?(room) && conn.current_user
    end.uniq
  end
  ```

4. **(Backend)** Include the list of users present in a room in the `rooms/show`
   response.

   In `RoomsController`:

   ```rb
   # app/controllers/api/rooms_controller.rb

   def show
     @room = Room.find(params[:id])
     # Add this line to save all the users in @room as an instance variable:
     @online_users = RoomsChannel.online_users(@room) << current_user
   end
   ```

   Add the following to the bottom of the __rooms/show.json.jbuilder__ view:

   ```rb
   # app/views/api/rooms/show.json.jbuilder

   # ...
   json.online_users do
     @online_users.each do |user|
       json.set! user.id do
         json.partial! 'api/users/user', user: user
       end
     end
   end
   ```

7. **(Frontend)** Add the new `onlineUsers` slice of the `rooms/show` response
   to the `Room` component's internal state.

   Refactor the `fetchRoom` thunk action creator in __store/rooms.js__:

   ```js
   // frontend/src/store/rooms.js

   // Add `onlineUsers` to the destructured properties:
   return csrfApiFetch(`rooms/${id}`).then(({ room, messages, users, onlineUsers }) => {
     dispatch(receiveMessages(messages));
     dispatch(receiveRoom(room));
     dispatch(receiveUsers(users));
     // Return `onlineUsers` so it becomes the argument to the next `.then`:
     return onlineUsers;
   });
   ```

   In the `Room` component's `useEffect` for entering a room, after fetching the
   room data, refactor the `.then` callback:

   ```js
   // frontend/src/components/Room.js

   // ...
   useEffect(() => {
   // Add an argument of `currentUsersInRoom`, with a default value of {}
   dispatch(fetchRoom(roomId)).then((currentUsersInRoom = {}) => {
     // Add this line to put `currentUsersInRoom` in state:
     setUsersInRoom(currentUsersInRoom);

     if (activeMessageRef.current) {
       scrollToMessage();
     } else {
       scrollToBottom();
     }
     prevRoom.current = roomId;
   });

   // ...
   ```

   Restart your server, refresh your browsers, and test it again. Now, if
   Garfield is already in a room when Sennacy enters, Sennacy should see
   Garfield's username in the list of users in the room.

### Reactions: Sending data to the server via WebSockets

The last Action Cable feature you'll add demonstrates the ability to send
messages from a client to the server through an Action Cable subscription.

There are two ways of doing so:

1. `subscription.send(data)`
   - The `received` method of the subscription's corresponding backend channel
     is invoked, taking in the client-sent `data` as an argument
   - The following example simply broadcasts out any data that is sent by
     clients:

   ```rb
   class RoomsChannel < ApplicationCable::Channel
     def receive(data)
       self.class.broadcast_to(@room, data)
     end
   end
   ```

2. `subscription.perform(action, data)`
   - `action` should be the name of a method defined in the subscription's
     corresponding backend channel. The named method is invoked with `data`
   - For example, if `subscription` represents a subscription to the
     `RoomsChannel`, `subscription.perform('say_hi')` would invoke
     `RoomsChannel#say_hi`

Why not just send a regular AJAX request that hits a backend route? Sending
client-to-server messages via Action Cable is useful for cases where a user
needs to perform non-RESTful actions that are visible to other connected users
but that don't persist any data to the database.

Live video chat might be an example: a user's webcam video is streamed to other
users live but isn't persisted in any fashion (hopefully).

This app uses a simpler example of fleeting, streamed data: reactions that
expire after 4 seconds.

1. **(Frontend)** In the `generateReactions` helper method of the `Room`
   component, refactor the `onClick` event handler to perform the
   `RoomsChannel#react` whenever a user clicks on a reaction emoji. In other
   words, you want the `onClick` event handler to run
   `subscription?.perform('react', { reaction })`. There is a slight issue,
   however: `subscription` is available only inside the `useEffect` where it is
   defined.

   To get around this limitation, use a [`useRef` hook] to create a `ref`erence
   called `react`. Like values stored in state, values stored in a `useRef` ref
   persist between renders; unlike values stored in state, changes to values in
   a ref will **NOT** trigger a rerender. Use this ref to store and run
   `subscription.perform`:

   ```js
   // frontend/src/components/Room.js

   function Room() {
     // ...
     
     // Add this line
     const react = useRef(null);

     useEffect(() => {
       // ...
       const subscription = consumer.subscriptions.create(
         // ...
       );

       // Add this line
       react.current = reaction => subscription?.perform('react', { reaction });

       return () => subscription?.unsubscribe();
     }, [roomId, dispatch]);

     // ...

     const generateReactions = (...reactions) => {
       // ...
       // change the onClick from:
       onClick={() => setReaction(currentUserId, reaction)}
       // to:
       onClick={() => react.current(reaction)}
       // ...
     };

     // ...
   }
   ```

[`useRef` hook]: https://reactjs.org/docs/hooks-reference.html#useref

2. **(Backend)** Define `RoomsChannel#react`, which broadcasts the emoji
   reaction it receives along with the id of the user who performed the
   reaction:

   ```rb
   # app/channels/rooms_channel.rb

   def react(reaction)
     self.class.broadcast_to @room, 
       type: 'RECEIVE_REACTION',
       id: current_user.id,
       **reaction
   end
   ```

3. **(Frontend)** Upon receiving a reaction broadcast, put the reaction in state
   (via the `setReaction` helper method), then set a timeout to remove it from
   state after 4 seconds:
  
   ```js
   // frontend/src/components/Room.js
  
   function Room() {
     // ...
     // Add the following line to keep track of active timeouts:
     const reactionTimeouts = useRef({});

     useEffect(() => {
       // ...
       subscription = consumer.subscriptions.create(
         { channel: 'RoomsChannel', id: roomId },
         {
           // Add `reaction` to destructured properties
           received: ({ type, message, user, id, reaction }) => {
             switch (type) {
               // ...cases for receiving and removing messages and users...

               // Add this case to set a reaction, then clear it after 4 seconds
               case 'RECEIVE_REACTION':
                 window.clearTimeout(reactionTimeouts.current[id]);
                 setReaction(id, reaction);
                 reactionTimeouts.current[id] = window.setTimeout(() => {
                   setReaction(id, null);
                 }, 4000);
                 break;
               default:
                 console.log('Unhandled broadcast: ', type);
                 break;
             }
           }
         }
       );
       // ...
     });
     // ...
   }
   ```

   Note: `reactionTimeouts` stores each active timeout under a key of the
   reacting user's id. If the same user reacts twice within 4 seconds, the first
   timeout is cancelled, so that their reaction clears 4 seconds after the
   second reaction.

## Bonus 1: Real-time rooms index

It's time to test your understanding!

Currently, you must refresh your page if you want to see any new rooms that have
been added to the app since your last refresh. Wouldn't it be nice to
have new rooms just appear in your rooms index as they are created (and removed
as they are deleted)? Use what you have learned to create this functionality.

A couple tips to get you started:

1. You will likely want to create a new channel. Where will you put the
   subscription?
2. This new channel is tied to an index rather a model instance, so you probably
   want to use `stream_from`, which takes a string denoting the channel name,
   instead of `stream_for`, which takes a model.
3. If you use `stream_from`, then you will need to call
   `ActionCable.server.broadcast(stream_name, broadcast_data)` instead of
   `SomeChannel.broadcast_to(model, broadcast_data)`.
4. Look at the Jbuilder view for your rooms index to see what information you
   need to send up for each new room created. Try to avoid resending all the
   rooms and/or sending up more information than is necessary for an index.

## Bonus 2: Deploy to Render

To complete your chat app, deploy it to Render! For the most part, you can just
follow the standard Render deployment instructions. You will, however, need to
do one additional step: set up a Redis instance to keep track of active
connections and subscriptions.

Your __config/cable.yml__ file has already configured Action Cable to use Redis
in production. You shouldn't have to change anything in that file, but for the
curious, this is what it looks like:

```rb
# config/cable.yml

# ...
production:
  adapter: redis
  url: <%= ENV.fetch("REDIS_URL") { "redis://localhost:6379/1" } %>
  channel_prefix: <your_app_name>_production
```

To set up Redis on Render, just go to your [Render dashboard] and click the `New
+` button in the upper right-hand corner. Select `Redis` on the resulting
dropdown menu. Give your Redis instance a `Name`, change the `Maxmemory-Policy`
to `noeviction`, and click `Create Redis`. From your Redis instance info page,
click `Connect` on the right and copy the `Internal Connection` value. Then,
when creating the web service for your app on Render, create a `REDIS_URL`
environment variable with the copied value of your internal Redis URL.

## Wrap Up

Congratulations, you have a multi-featured messaging app! Go ahead and request
the solution from an instructor if you would like to compare.

[Render dashboard]: https://dashboard.render.com/