import csrfApiFetch from './csrf';

const RECEIVE_USER = 'RECEIVE_USER';
const RECEIVE_USERS = 'RECEIVE_USERS';
const REMOVE_CURRENT_USER = 'REMOVE_CURRENT_USER';
const RECEIVE_CURRENT_USER = 'RECEIVE_CURRENT_USER';

export const receiveUser = user => {
  return {
    type: RECEIVE_USER,
    user
  };
};

export const receiveUsers = users => {
  return {
    type: RECEIVE_USERS,
    users
  };
};

export const receiveCurrentUser = user => {
  return {
    type: RECEIVE_CURRENT_USER,
    user
  };
};

export const removeCurrentUser = id => {
  return {
    type: REMOVE_CURRENT_USER,
    id
  };
};

export const storeCurrentUser = user => {
  if (user) localStorage.setItem("currentUser", JSON.stringify(user));
  else localStorage.removeItem("currentUser");
}

const startSession = (user, dispatch) => {
  storeCurrentUser(user);
  return dispatch(receiveCurrentUser(user));
};

export const endSession = (currentUserId, dispatch) => {
  storeCurrentUser(null);
  return dispatch(removeCurrentUser(currentUserId));
};

export const signup = user => dispatch => {
  return csrfApiFetch('users', {
    method: 'POST',
    data: { user }
  }).then(
    user => startSession(user, dispatch)
  );
};

export const login = user => dispatch => {
  return csrfApiFetch('users/login', {
    method: 'POST',
    data: { user }
  }).then(
    user => startSession(user, dispatch)
  );
};

export const logout = () => (dispatch, getState) => {
  return csrfApiFetch('users/logout', {
    method: 'DELETE'
  }).then(
    () => endSession(getState().currentUserId, dispatch)
  ).catch(error => {
    // If localStorage has a currentUser but the backend does not, logout on the 
    // frontend. This can happen, e.g., if the db is reseeded and the server
    // restarted. 401 === unauthorized/unauthenticated
    if (error.status === 401) return endSession(getState().currentUserId, dispatch)
  });
};

export const usersReducer = (state = {}, action) => {
  switch (action.type) {
    case RECEIVE_USER:
    case RECEIVE_CURRENT_USER:
      const { user } = action;
      return { ...state, [user.id]: user };
    case RECEIVE_USERS:
      return { ...state, ...action.users };
    case REMOVE_CURRENT_USER:
      const newState = { ...state };
      delete newState[action.id];
      return newState;
    default:
      return state;
  }
};

export const currentUserIdReducer = (state = null, action) => {
  switch (action.type) {
    case RECEIVE_CURRENT_USER:
      return action.user.id;
    case REMOVE_CURRENT_USER:
      return null;
    default:
      return state;
  }
};