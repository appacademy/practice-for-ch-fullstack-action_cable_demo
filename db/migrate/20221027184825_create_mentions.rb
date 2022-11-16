class CreateMentions < ActiveRecord::Migration[7.0]
  def change
    create_table :mentions do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :message, null: false, foreign_key: true
      t.boolean :read, null: false, default: false
      t.index ["user_id", "message_id"], unique: true
      t.timestamps
    end
  end
end
