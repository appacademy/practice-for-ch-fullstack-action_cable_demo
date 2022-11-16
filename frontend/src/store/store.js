import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import thunk from 'redux-thunk';
import { createLogger } from 'redux-logger';
import { messagesReducer } from './messages';
import { roomsReducer } from './rooms';
import { usersReducer, currentUserIdReducer } from './users';
import { mentionsReducer } from './mentions';

const configureStore = () => {
  let preloadedState = {};
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (currentUser) {
    preloadedState = {
      users: {
        [currentUser.id]: currentUser
      },
      currentUserId: currentUser.id
    };
  }

  let enhancer;
  
  if (process.env.NODE_ENV === 'production') {
    enhancer = applyMiddleware(thunk);
  } else {
    const logger = createLogger({
      collapsed: (_, __, logEntry) => !logEntry.error,
    });
    const composeEnhancers =
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    enhancer = composeEnhancers(applyMiddleware(thunk, logger));
  }

  return createStore(
    rootReducer,
    preloadedState,
    enhancer
  );
};

const rootReducer = combineReducers({
  users: usersReducer,
  messages: messagesReducer,
  rooms: roomsReducer,
  mentions: mentionsReducer,
  currentUserId: currentUserIdReducer
});

export default configureStore;
