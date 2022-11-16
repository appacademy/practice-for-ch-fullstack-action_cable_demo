# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.0].define(version: 2022_10_27_184825) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "mentions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "message_id", null: false
    t.boolean "read", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["message_id"], name: "index_mentions_on_message_id"
    t.index ["user_id", "message_id"], name: "index_mentions_on_user_id_and_message_id", unique: true
  end

  create_table "messages", force: :cascade do |t|
    t.bigint "author_id", null: false
    t.bigint "room_id", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["author_id"], name: "index_messages_on_author_id"
    t.index ["room_id"], name: "index_messages_on_room_id"
  end

  create_table "rooms", force: :cascade do |t|
    t.bigint "owner_id", null: false
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["owner_id"], name: "index_rooms_on_owner_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "username", null: false
    t.string "password_digest", null: false
    t.string "session_token", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["session_token"], name: "index_users_on_session_token", unique: true
    t.index ["username"], name: "index_users_on_username", unique: true
  end

  add_foreign_key "mentions", "messages"
  add_foreign_key "mentions", "users"
  add_foreign_key "messages", "rooms"
  add_foreign_key "messages", "users", column: "author_id"
  add_foreign_key "rooms", "users", column: "owner_id"
end