# Action Cable Demo: Part I

In this demo, you will create a chat app. Logged in users can create chat rooms
and post messages in these rooms. Users can also send an emoji reaction, which
will appear next to their username in the list of users in the room. Messages
can mention other users by including `@<username>`, and users can view messages
that mention them via a dropdown in the navbar.

Check out the live demo [here][live-demo].

Start by downloading the demo starter. Follow the typical setup routine: in the
root directory, run `bundle install`, `rails db:setup`, and `rails s` to start
your backend server. In another terminal, then `cd` into the __frontend__ folder
and run `npm install` and `npm start`. (For production, running `npm run build`
in the root directory will build your static frontend files and save them to the
__/public__ directory for Rails to serve.)

The core message and mention CRUD have already been built out, and the UI is
complete. All that needs to be added is real-time functionality via Action
Cable: new messages, mentions, and reactions should automatically appear without
requiring a refresh, and the list of users in a room should automatically update
as users enter and leave.

Some notes:

- The Rails backend was created with the `--api` flag and serves as an API only.

- The backend does use session-based authentication, however. Rails API apps
  disable cookies and the session by default, so they have been manually added
  back in:

  ```rb
  # config/application.rb

  config.middleware.use ActionDispatch::Cookies
  config.middleware.use ActionDispatch::Session::CookieStore, 
    key: '_action_cable_demo_session', 
    same_site: :lax, 
    secure: Rails.env.production?
  ```

- Rails API apps also disable CSRF protection by default; that protection has
  also been manually activated:

  ```rb
  # app/controllers/application_controller

  include ActionController::RequestForgeryProtection
  protect_from_forgery with: :exception
  ```

  (The `attach_authenticity_token` `before_action` in
  __app/controllers/application_controller.rb__ ensures that a CSRF token
  appears in the header of every response.)

- In __routes.rb__, all `GET` requests that do not match a specified route are
  routed to `static_pages#frontend_index`, which serves up
  __public/index.html__. (Running `npm run build` in the root directory will
  build your production frontend files into this __public__ directory.)

- Keys in requests are transformed from camelCase to snake_case because of the
  `snake_case_params` `before_action` added in `ApplicationController`.
  Likewise, keys in Jbuilder responses are transformed from snake_cake to
  camelCase because of the `Jbuilder.key_format camelize: :lower` line added to
  __config/environment.rb__.

[live-demo]: https://aa-action-cable-demo.herokuapp.com/

## General Action Cable setup

1. In the __frontend__ directory, run `npm install @rails/actioncable`.

2. Add a __consumer.js__ file with the following code to the __src__ folder
   within your __frontend__ folder:

   ```js
   import { createConsumer } from "@rails/actioncable";
   
   let wsUrl;
   if (process.env.NODE_ENV !== "production") 
     wsUrl = "ws://localhost:5000/cable";
   else
     wsUrl = "/cable";

   export default createConsumer(wsUrl);
   ```

   **Note:** For most browsers, simply calling `createConsumer('/cable')` will
   work even in `development`. The `'/cable'` argument will ultimately be
   expanded to the full URL, which in `development` will be
   `ws://localhost:3000/cable`. Again, for most browsers, this is fine: requests
   that come to `localhost:3000/cable` will be forwarded to the backend at
   `localhost:5000/cable` through the proxy set up in __frontend/package.json__.
   Chrome, however, currently has trouble processing WebSockets through a proxy.
   The code above accordingly sets the entire URL in `development` to ensure
   compatibility across browsers.

   The argument passed to `createConsumer` is the path that hosts your Action
   Cable server. (Rails defaults to hosting the server at `/cable`.)
   `createConsumer` can grab this path automatically from any Rails-generated
   HTML file that has `<%= action_cable_meta_tag %>` in its `head`; that's why
   you will often see `createConsumer()` called without any arguments. With
   Rails functioning as an API, however, it plays no role in generating the
   frontend HTML files, so you have to specify the path manually.

3. Identify the user associated with each WebSocket connection by adding the
   following to `ApplicationCable::Connection`:

   ```rb
   # app/channels/application_cable/connection.rb

   # this line lets you call `current_user` directly from your channel instances
   identified_by :current_user

   def connect
     self.current_user = find_verified_user
   end

   private
   def find_verified_user
     if current_user = User.find_by(session_token: request.session[:session_token])
       current_user
     else
       reject_unauthorized_connection
     end
   end
   ```

   (`reject_unauthorized_connection` is a provided [Rails method][reject].)

   This is similar to your typical `ApplicationController#current_user`. A
   `session` getter isn't defined for `ApplicationCable::Connection`, however,
   so you need to access `session` via the `request` object. (You could also
   access it directly through cookies:
   `cookies.encrypted[:_<your_app_name>_session]`). For more on this pattern for
   setting the current user, see the [Rails guide to Connections][connections].
  
  (**Note:** You actually have access to the `request` object in your
  controllers as well. Within a controller action, `request.session == session`
  will return `true`. [Read more here.][request])

  Awesome - you've now set up the basic infrastructure needed for Action Cable!
  Next, you'll build some channels and subscriptions on top of this
  infrastructure to make the app come to life!

[reject]: https://www.rubydoc.info/github/rails/rails/ActionCable%2FConnection%2FAuthorization:reject_unauthorized_connection
[connections]: https://guides.rubyonrails.org/action_cable_overview.html#server-side-components-connections
[request]: https://guides.rubyonrails.org/action_controller_overview.html#the-request-object

## Live chat

You'll start by creating a `RoomsChannel`, which the client will subscribe to in
the `Room` component. When a new message is created in that room, `RoomsChannel`
will broadcast it to everyone subscribed to that room's stream.

### Broadcasting new messages
  
1. **(Frontend)** In the `Room` component (__frontend/src/components/Room.js__),
   add the following to the `useEffect` that runs when entering a room--it calls
   `fetchRoom`--to subscribe to a room's channel upon entering it and
   unsubscribe upon leaving.

   ```js
   // frontend/src/components/Room.js

   // Add the following import at the top of the file:
   import consumer from '../consumer';

   function Room() {
     // ...
     // Effect to run when entering a room
     useEffect(() => {
       // ...

       // Add the following lines to the end of the `useEffect` to create a
       // subscription:
       const subscription = consumer.subscriptions.create(
         { channel: 'RoomsChannel', id: roomId }
       );

       return () => subscription?.unsubscribe();
     }, [roomId, dispatch]);  // This line is already present in the file
     // ...
   }
   ```

2. **(Backend)** Create a new file __rooms_channel.rb__ in __app/channels__:

   ```rb
   # app/channels/rooms_channel.rb

   class RoomsChannel < ApplicationCable::Channel
     def subscribed
       @room = Room.find_by(id: params[:id])
       stream_for @room
     end
   end
   ```

3. **(Backend)** Broadcast every new message in `MessagesController#create`:

   ```rb
   # app/controllers/api/messages_controller.rb

   def create
     # ...
     if @message.save
       # Add the following line to broadcast to subscribers of @message.room:
       RoomsChannel.broadcast_to(@message.room, @message)
       # ...
     end
   end
   ```

4. **(Frontend)** Add a second argument to `consumer.subscriptions.create` in
   the Room component's `useEffect` that you adjusted earlier, to handle
   broadcasts from the server:
  
   ```js
   // frontend/src/components/Room.js

   subscription = consumer.subscriptions.create(
     { channel: 'RoomsChannel', id: roomId },
     {
       received: message => {
         console.log('Received message: ', message);
       }
     }
   );
   ```

   Time to test what you've written so far. Start up the server (`rails s`) and
   your frontend (`npm start` in __frontend__). When localhost loads in your
   browser, log in as Garfield. Enter "Garfield's First Room". This should
   trigger the Room component's `useEffect`, which will subscribe to this room's
   stream.

   Confirm that the subscription was created by looking in your server log. You
   should see somewhere: `RoomsChannel is streaming from rooms:<long-string>`.
   (If you instead see `Subscription class not found: "RoomsChannel"`, make sure
   that __rooms_channel.rb__ is in the __app/channels__ folder and not in
   __app/channels/application_cable__.)

   Next, in a second browser (or incognito window), open localhost, login as
   Sennacy, and enter "Garfield's First Room". Try putting both browser windows
   side by side. With the DevTools open in both browsers, send a message as
   Sennacy. The chat room won't update yet--that comes next--but you should see
   the message logged in both browser consoles! Awesome!

### Rendering broadcast messages

To render the new message, you'll need to make a few tweaks; instead of straight
up broadcasting the message model, you'll want to use the `messages/show`
Jbuilder view, with its additional `user` data and automatic transformation of
keys into camelCase. Then, on the frontend, you can dispatch this data to the
Redux store.

5. **(Backend)** Broadcast the `messages/show` Jbuilder view instead of the
   message model.

   First, add a `from_template` helper method to `ApplicationController`, which
   renders a Jbuilder template, returning a Ruby `Hash`:

   ```rb
   # app/controllers/application_controller.rb

   def from_template(template, locals = {})
     JSON.parse(self.class.render(:json, template: template, locals: locals))
   end
   ```

   Note that `from_template` calls `ApplicationController::render`, which is
   similar to the instance method of the same name. Instead of actually sending
   a response to the user, though, it merely returns a string of the response
   body.

   Next, use this helper method to refactor the new message broadcast in
   `MessagesController#create`:

   ```rb
   # app/controllers/api/messages_controller.rb

     RoomsChannel.broadcast_to @message.room,
       from_template('api/messages/show', message: @message)
   ```

   Check that the broadcast data logged in the browser now has camelCase keys
   and matches the shape of the `messages/show` Jbuilder view.

6. **(Frontend)** In the `received` subscription callback passed to
   `consumer.subscriptions.create`, handle this broadcasted message data by
   putting it into the Redux store instead of logging it to the console:

   ```js
   // frontend/src/components/Room.js

   received: ({ message, user }) => {
     dispatch(receiveMessage(message));
     dispatch(receiveUser(user));
   }
   ```

   Now that all new messages are getting put into the Redux store, you can
   simplify the `.then` callback in `handleSubmit`:

   ```js
   // frontend/src/components/Room.js

   createMessage({ body, roomId, authorId: currentUserId }).then(() => {
     setBody('');
   });
   ```

   After broadcasting in `MessagesController#create` (in
   __app/controllers/api/messages_controller.rb__), you no longer need to render
   the `show` view. Change `render :show, locals: { message: @message }` to
   `render json: nil, status: :ok`.

   Test your app again, remembering to refresh both browsers to get the latest
   JavaScript. New messages should now automatically appear for both users!

   This may be all the complexity you'll need for Action Cable in your own app.
   Take some time to review the steps above, tweaking things, adding console
   logs and debuggers, etc., to get a handle on what's going on.

### Broadcasting the deletion of messages

Unfortunately, if you delete a message in one browser, it won't automatically
disappear in the other. Let's change that.

7. **(Backend)** Broadcast the deletion of a message.

   Now that you are introducing multiple types of broadcasts, you'll want to
   handle each of them on the frontend differently. Taking a cue from Redux
   reducers, add a `type` key to each broadcast.

   In `MessageController#create`, refactor the new message broadcast:

   ```rb
   # app/controllers/api/messages_controller.rb

   RoomsChannel.broadcast_to @message.room,
     type: 'RECEIVE_MESSAGE',
     **from_template('api/messages/show', message: @message)
   ```

   The `**`, or double splat, spreads out the key-value pairs from the `Hash`
   returned by `from_template`, so they can be merged with the `type` key-value
   pair to form a single `Hash`.

   Now, you can add a `DESTROY_MESSAGE` broadcast in the `destroy` action:

   ```rb
   # app/controllers/api/messages_controller.rb

   def destroy
     # ...
     RoomsChannel.broadcast_to @message.room,
       type: 'DESTROY_MESSAGE',
       id: @message.id
     # ...
   end
   ```

8. **(Frontend)** Refactor the `received` subscription callback passed to
   `consumer.subscriptions.create` to use a `switch` statement for handling
   different broadcast types. Include a case for the new `DESTROY_MESSAGE`
   broadcast type:

   ```js
   // frontend/src/components/Room.js

   received: ({ type, message, user, id }) => {
     switch (type) {
       case 'RECEIVE_MESSAGE':
         dispatch(receiveMessage(message));
         dispatch(receiveUser(user));
         break;
       case 'DESTROY_MESSAGE':
         dispatch(removeMessage(id));
         break;
       default:
         console.log('Unhandled broadcast: ', type);
         break;
     }
   }
   ```

   Remove the now superfluous `.then` callback in `handleDelete`:

   ```js
   // frontend/src/components/Room.js

   const handleDelete = messageId => {
     destroyMessage(messageId);
   };
   ```

   Go ahead and test out that deleted messages get automatically removed in
   both browsers!

## Live mentions

Next, you'll integrate Action Cable with mentions. Pay attention to the patterns
that carry over from setting up the `RoomsChannel`.

1. **(Backend)** Define `MentionsChannel` and broadcast new mentions in
   `MessagesController#create`:

   In a new file, __app/channels/mentions_channel.rb__:

   ```rb
   class MentionsChannel < ApplicationCable::Channel
     def subscribed
       stream_for current_user
     end
   end
   ```

   In the `MessagesController`:

   ```rb
   # app/controllers/api/messages_controller.rb

   def create
   # ...
     if @message.save
       # Add the following to broadcast to users mentioned in this message:
       @message.mentions.includes(:user, message: [:room]).each do |mention| 
         MentionsChannel.broadcast_to mention.user,
           type: 'RECEIVE_MENTION',
           **from_template('api/mentions/show', mention: mention)
       end
       # ...
     end
   end
   ```

   Note that a message's mentions are automatically generated in an
   `after_create` callback defined in `Message` (see __app/models/message.rb__).

2. **(Frontend)** Subscribe to `MentionsChannel` in the `Mentions` component:

   ```js
   // frontend/src/components/Mentions.js
  
   // Add this import at the top of the file:
   import consumer from '../consumer';
  
   function Mentions() {
     // ...
     useEffect(() => {
       // ...
       const subscription = consumer.subscriptions.create(
          { channel: 'MentionsChannel' },
          {
            received: ({ type, mention, message, user }) => {
              switch (type) {
                case 'RECEIVE_MENTION':
                  dispatch(receiveMention(mention));
                  dispatch(receiveMessage(message));
                  dispatch(receiveUser(user));
                  setHasUnseen(true);
                  break;
                default:
                  console.log('Unhandled broadcast: ', type);
                  break;
              }
            }
          }
        );

        return () => subscription?.unsubscribe();
     }, [dispatch]);

     // ...
   }
   ```

   All of the JSX and Redux logic is already taken care of, so it's time to
   test this out! Send a message from Sennacy, with the text `@garfield`
   somewhere in the body. Garfield should automatically receive this mention!

## Next steps

Move on to Part II to see how to implement more advanced examples of  Action
Cable's capabilities, or jump ahead by requesting the solution. Visit the Basic
Workflow reading for a high-level, generalized summary of the steps you took
above.