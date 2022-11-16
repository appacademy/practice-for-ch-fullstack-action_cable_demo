class CreateMessages < ActiveRecord::Migration[7.0]
  def change
    create_table :messages do |t|
      t.references :author, null: false, foreign_key: { to_table: :users }
      t.references :room, null: false, foreign_key: true
      t.text :body, null: false

      t.timestamps
    end
  end
end
