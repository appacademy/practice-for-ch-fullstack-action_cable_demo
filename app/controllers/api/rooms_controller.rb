class Api::RoomsController < ApplicationController
  before_action :require_logged_in, except: [:index]

  def index
    @rooms = Room.includes(:owner).all
  end

  def show
    @room = Room.includes(messages: [:author, :mentioned_users]).find(params[:id])
    # Your code here
  end

  def create
    @room = Room.new(room_params)

    if @room.save
      render '_room', locals: { room: @room }
    else
      render json: @room.errors.full_messages, status: 422
    end
  end

  def destroy
    @room = Room.find(params[:id])
    @room.destroy
    # Your code here
    render json: nil, status: :ok
  end

  private

  def room_params
    params.require(:room).permit(:name, :owner_id)
  end
end