import { receiveMessages } from './messages';
import { receiveUsers } from './users';
import csrfApiFetch from './csrf';

const RECEIVE_ROOM = 'RECEIVE_ROOM';
const REMOVE_ROOM = 'REMOVE_ROOM';
const RECEIVE_ROOMS = 'RECEIVE_ROOMS';

export const receiveRoom = room => {
  return {
    type: RECEIVE_ROOM,
    room
  };
};

export const removeRoom = roomId => {
  return {
    type: REMOVE_ROOM,
    roomId
  };
};

export const fetchRooms = () => dispatch => {
  return csrfApiFetch('rooms').then(({ rooms, users }) => {
    dispatch({
      type: RECEIVE_ROOMS,
      rooms
    });
    dispatch(receiveUsers(users));
  });
};

export const fetchRoom = id => dispatch => {
  return csrfApiFetch(`rooms/${id}`).then(({ room, messages, users }) => {
    dispatch(receiveMessages(messages));
    dispatch(receiveRoom(room));
    dispatch(receiveUsers(users));
  });
};

export const createRoom = room => dispatch => {
  return csrfApiFetch('rooms', {
    method: 'POST',
    data: { room }
  }).then(room => dispatch(receiveRoom(room)));
};

export const destroyRoom = roomId => dispatch => {
  return csrfApiFetch(`rooms/${roomId}`, {
    method: 'DELETE'
  }).then(() => dispatch(removeRoom(roomId)));
};

export const roomsReducer = (state = {}, action) => {
  switch (action.type) {
    case RECEIVE_ROOM:
      const { room } = action;
      return { ...state, [room.id]: room };
    case RECEIVE_ROOMS:
      return { ...state, ...action.rooms };
    case REMOVE_ROOM:
      const newState = { ...state };
      delete newState[action.roomId];
      return newState;
    default:
      return state;
  }
};