import csrfApiFetch from './csrf';
import { receiveMessages } from './messages';
import { receiveUsers, endSession } from './users';

const RECEIVE_MENTION = 'RECEIVE_MENTION';
const RECEIVE_MENTIONS = 'RECEIVE_MENTIONS';
const REMOVE_MENTION = 'REMOVE_MENTION';
const READ_MENTION = 'READ_MENTION';

export const receiveMention = mention => {
  return {
    type: RECEIVE_MENTION,
    mention
  };
};

export const removeMention = mentionId => {
  return {
    type: REMOVE_MENTION,
    mentionId
  };
};

export const fetchMentions = () => (dispatch, getState) => {
  return csrfApiFetch('mentions').then(({ mentions, messages, users }) => {
    dispatch({
      type: RECEIVE_MENTIONS,
      mentions
    });
    dispatch(receiveMessages(messages));
    dispatch(receiveUsers(users));
  }).catch(error => {
    // If localStorage has a currentUser but the backend does not, logout on the 
    // frontend. This can happen, e.g., if the db is reseeded and the server
    // restarted. 401 === unauthorized/unauthenticated
    if (error.status === 401) return endSession(getState().currentUserId, dispatch)
  });
};

export const readMention = id => dispatch => {
  return csrfApiFetch(`mentions/${id}/read`, {
    method: 'PATCH'
  }).then(
    () => dispatch({
      type: READ_MENTION,
      mentionId: id
    })
  );
};

export const getMentions = () => state => {
  let numUnread = 0;
  const mentions = Object.values(state.mentions)
        .filter(mention => (
          mention.userId === state.currentUserId
          && state.messages[mention.messageId]
        ))
        .map(mention => {
          if (!mention.read) numUnread++;
          const message = state.messages[mention.messageId];
          const author = state.users[message.authorId]?.username;
          const room = state.rooms[message.roomId] || {};
          return {
            ...mention,
            room,
            message: { ...message, author }
          };
        })
        .sort((a, b) => {
          if (a.read !== b.read) {
            return a.read ? 1 : -1;
          } else {
            const [timeA, timeB] = [a, b].map(
              ({ message }) => new Date(message?.createdAt).getTime()
            );
            return Math.sign(timeB - timeA);
          }
        });
  return {
    mentions,
    numUnread
  };
}

export const mentionsReducer = (state = {}, action) => {
  switch (action.type) {
    case RECEIVE_MENTION: {
      const { mention } = action;
      return { ...state, [mention.id]: mention };
    }
    case READ_MENTION: {
      const mention = state[action.mentionId];
      return { ...state, [mention.id]: { ...mention, read: true } };
    }
    case RECEIVE_MENTIONS:
      return { ...state, ...action.mentions };
    case REMOVE_MENTION:
      const newState = { ...state };
      delete newState[action.mentionId];
      return newState;
    default:
      return state;
  }
};