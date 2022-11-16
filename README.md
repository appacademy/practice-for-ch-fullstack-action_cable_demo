# Introduction To Action Cable

Action Cable is a framework for integrating WebSockets with a Rails application.
It allows you to include real-time features in your application, like live chat
or push notifications.

## WebSockets

WebSockets is a communication protocol between clients and servers that is an
alternative to HTTP. Like HTTP, WebSockets is built on the TCP protocol. Unlike
HTTP, though, WebSockets is fully 2-way, or *duplex*:
  
- With HTTP, the only way for a server to send data to a client is by the
  client's initiating a request to the server.
- With WebSockets, a server can send data to a client without an explicit
  request from the client.
  
In the context of live chat, for example, this means that new messages can be
pushed to the client without the client having to ask the server, 'Any new
messages?'.

Unlike the stateless request-response cycle of HTTP, a client using WebSockets
will establish a persistent *connection* with a server, usually upon loading the
web app.

As long as this connection is open, the client and server can freely send data
to each other. The connection stays open until either the server or the client
explicitly closes it, although many WebSocket frameworks will automatically take
care of closing and/or re-opening connections for you when you close tabs,
experience network interruptions, etc.

Because connections are persistent, and thus stateful, servers need to store
data about connections somewhere. An on-disk database such as Postgres would
work; however, it would be quite slow. For this reason, many apps use the
`Redis` library to manage WebSocket connections. `Redis` keeps an *in-memory*
key-value data store, which is much faster than a traditional database. It's the
default option for the Rails production environment.

## The model: Pub/sub, streams, and channels

Many WebSocket frameworks, including Action Cable, build a Pub/Sub
(Publish/Subscribe) model on top of this basic connection infrastructure. This
is a way of organizing what data the server should send to which connected
clients.

Imagine the simplest possible WebSocket system: a news app that, whenever a new
story comes in, broadcasts a notification to every connected client. It's easy:
every connected client receives every broadcast. But this system wouldn't work
for a chat room app. When a new message gets posted, only the users in that
same room should receive a broadcast containing the new message.  

In a Pub/Sub model, clients can *subscribe* to a particular subset of all the
broadcasts the *publisher* (server) sends out; in Action Cable, each subset is
called a *stream*.

The way it works: every broadcast belongs to a particular stream identified by a
unique string — say, `chat_room_12`. When a client subscribes to a stream, this
means they want to receive every broadcast belonging to that stream. Then, for
every broadcast, the server checks to see which clients have subscribed to the
broadcast's associated stream, and sends it only to those clients.

Most WebSocket frameworks will add on more layers of abstraction to this
Pub/Sub model. In Action Cable, `channels` are used to organize streams. Let's
say that in addition to a `chat_room_12` stream, there are `chat_room_14` and
`chat_room_312` streams. Clearly, all of these streams are alike; with Action
Cable, they'd be managed by the same channel.

Channels are roughly analogous to controllers: just like HTTP requests related
to users might go through the `UsersController`, subscriptions to chat room
streams might go through the `ChatRoomsChannel`.

## Action Cable: The basics

Action Cable, like most WebSocket frameworks, features both a client-side
library and a server-side library. Both are included when you start a new Rails
project: the server-side library is built into Rails proper, and the client-side
JavaScript library is `@rails/actioncable`.

**Note:** If you are creating an independent React frontend, you'll need to `npm
install @rails/actioncable` in the React part of the project yourself.

### Backend

Your backend Action Cable files live in __app/channels__. It starts with two
files, __connection.rb__ and __channel.rb__, in a subdirectory
__application_cable__:

- __connection.rb__ defines `ApplicationCable::Connection`. A single instance of
  this class is created for each client that opens a WebSocket connection with
  the server.
  - Usually, you'll add methods here, such as `connect`, and instance variables,
    such as `current_user`, which establish ways of identifying the particular
    connection.
  - You can't use `ApplicationController#current_user`, unfortunately, as your
    router doesn't create a controller instance when a client opens a WebSocket
    connection, so you'll have to use other means to identify the current user.
  - Note that a client can create multiple channel/stream subscriptions, all
    of which use the same underlying _connection_.
- __channel.rb__ defines `ApplicationCable::Channel`, which is the parent class
  of each channel you define. Each instance of a channel represents a single
  subscription, which is associated with one (or more) streams.

Inside the __app/channels__ folder, you'll create a new file,
__<something>_channel.rb__, for each channel you want to create - roughly one
for each real-time feature your app includes. There, you'll define a class that
inherits from `ApplicationCable::Channel`. For example, __chat_channel.rb__
might look something like this:

```rb
class ChatChannel < ApplicationCable::Channel
  def subscribed
    # stream_from "fun_stream_name"
    stream_for Room.find_by(id: params[:id])
  end
end
```

Inside each channel you'll generally define a `subscribed` method, which gets
called after a client subscribes to the channel. In this method, you'll set up a
subscription to a particular stream, often using data passed in with the
subscription request, which is available in `params`.

You can supply the stream's name directly to `stream_from` or, by passing an
Active Record model to `stream_for`, you can let Rails determine the stream
name based on the combination of the current channel and the supplied model.

To send out a broadcast, which you can do from anywhere in your app--e.g., in
your controller actions--you have two options:

1. If you used `stream_from`:
    `ActionCable.server.broadcast(stream_name, broadcast_data)`

2. If you used `stream_for`:
    `SomeChannel.broadcast_to(model, broadcast_data)`

Since streams are often associated with particular models, `stream_for` is more
commonly used. It's also easier--you don't have to enforce a consistent naming
convention for streams--and less likely to silently fail, since there's no risk
of misspelling a stream name. For these reasons, `stream_for` should generally
be your go-to option.

In each case, `broadcast_data` can be any serializable object: a string, an
array, a hash, a model (which gets converted to a hash), etc.

### Frontend

When building an independent React frontend, you will need to `npm install
@rails/actioncable` and create a __consumer.js__ file inside the __src__
directory with the following code:

```js
import { createConsumer } from "@rails/actioncable";
  let wsUrl;
  if (process.env.NODE_ENV !== "production") 
    wsUrl = "ws://localhost:5000/cable";
  else
    wsUrl = "/cable";

export default createConsumer(wsUrl);
```

> Note: The argument passed to `createConsumer` is the URL of your Action Cable
> server. (Rails defaults to hosting the server at `/cable`.) `createConsumer`
> can grab this path automatically from any Rails-generated HTML file that has
> `<%= action_cable_meta_tag %>` in its `head`; that's why you will often see
> `createConsumer()` called without any arguments. A Rails API backend, however,
> plays no role in generating the frontend HTML files, so you have to specify
> the path manually.

This exports a `consumer` object, which represents the client's WebSocket
connection to the server. You'll import this `consumer` object in your component
files in order to subscribe to channels, with `consumer.subscriptions.create()`:

```js
consumer.subscriptions.create(
  { channel: 'NameOfChannel', /* other data needed to set up subscription */ },
  { received: broadcast => {} }
);
```

The first argument is an object that specifies what you want to subscribe to.
The `channel` property is mandatory; any other data is passed along as `params`
to the backend channel.

The second argument should be an object with a `received` function, which will
get invoked whenever a broadcast comes in from the server, with broadcasted data
passed in as an argument.

A `subscription` object is returned, which you can use to unsubscribe by
calling `subscription.unsubscribe()`.

## Deployment

As mentioned earlier, an app using Action Cable needs some system for managing
and keeping track of active connections and subscriptions; this system is called
an _adapter_.

You can configure adapters for different environments in the
__config/cable.yml__ file. The default configuration, which you won't need to
change, should look something like this:

```yml
development:
  adapter: async

test:
  adapter: test

production:
  adapter: redis
  url: <%= ENV.fetch("REDIS_URL") { "redis://localhost:6379/1" } %>
  channel_prefix: action_cable_demo_production
```

The development and production environments use `async` and `test` adapters,
respectively, which both store connection data in-memory in your Rails server.

The production environment uses the `redis` adapter. This adapter requires the
URL of a Redis server, which by default is retrieved from the `REDIS_URL`
environment variable.

To get Action Cable working in your production environment using Redis, you need
to:

1. Install the `redis` gem by uncommenting it in your Gemfile and running
   `bundle install`. (The `redis` gem should be installed by default if Action
   Cable was included in your initial Rails build.)
2. Set up a Redis server, then set the `REDIS_URL` environment variable in your
   production environment to point to this server's URL.

Render makes the second step easy. Just go to the Render dashboard of your app
and click the `New +` button in the upper right-hand corner. Select `Redis` on
the resulting dropdown menu. Give your Redis instance a `Name`, change the
`Maxmemory-Policy` to `noeviction`, and click `Create Redis`.

From your Redis instance info page, click `Connect` on the right and copy the
`Internal Connection` value. Then, when creating the web service for your app on
Render, create a `REDIS_URL` environment variable with the value of your
internal Redis URL. A Redis URL has the following form:

```plaintext
redis://<username>:<password>@<host/ipaddress>:<port>/<database>
```

> **Note:** For secure (SSL) connections, use `rediss` instead of `redis` for
> the URL scheme.

You can omit any irrelevant portions of the URL, basically anything except the
scheme and host. For instance, your Render internal Redis URL typically has only
scheme, name/host, and standard Redis port `6379`. It should look something like
this:

```plaintext
redis://red-cdbuelmn8mps6fh8vnf0:6379
```

> **Note:** If you don't want to host your Redis database on Render, [Redis
> Enterprise] offers a free 30MB plan.

That's it! Now Action Cable should work in production.

**Note:** If you are making a web service and you would like to allow clients to
connect to Action Cable from other websites or domains, you'll need to
explicitly allow this. Learn how to do this [here][ac-origins].

## Resources

- [Official Rails Action Cable Guide][ac-guide]
- [WebSockets Under the Hood (using Vanilla JavaScript)][websockets-guide]
- [Redis][redis]

[ac-guide]: https://guides.rubyonrails.org/action_cable_overview.html
[websockets-guide]: https://javascript.info/websocket
[redis]: https://redis.io/
[Redis Enterprise]: https://redis.com/try-free/
[ac-origins]: https://guides.rubyonrails.org/action_cable_overview.html#allowed-request-origins