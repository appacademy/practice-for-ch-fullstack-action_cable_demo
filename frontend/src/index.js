import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import configureStore from './store/store';
import csrfApiFetch from './store/csrf';
import { storeCurrentUser, receiveCurrentUser } from './store/users';
import './stylesheets/application.scss';

const store = configureStore();

const Root = () => (
  <Provider store={store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>
);

const renderApplication = () => {
  ReactDOM.render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
    document.getElementById('root')
  );
};

export const restoreSession = () => async dispatch => {
  const response = await csrfApiFetch("users/restore_user");
  storeCurrentUser(response);
  if (response) dispatch(receiveCurrentUser(response.user));
  return response;
};

if (
  localStorage.getItem("currentUser") === null ||
  localStorage.getItem("X-CSRF-Token") === null 
) {
  store.dispatch(restoreSession()).then(renderApplication);
} else {
  renderApplication();
}
