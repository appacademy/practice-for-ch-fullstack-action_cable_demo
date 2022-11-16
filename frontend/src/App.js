import { Route, Switch, Redirect } from 'react-router-dom';
import { useSelector } from 'react-redux';
import NavBar from './components/Navbar';
import RoomsIndex from './components/RoomsIndex';
import Room from './components/Room';
import { LoginForm, SignupForm } from './components/SessionForm';

function App() {
  const currentUser = useSelector(state => state.users[state.currentUserId]);
  
  return (
    <>
      <NavBar />
      <Switch>
        <Route path='/login' component={LoginForm} />
        <Route path='/signup' component={SignupForm} />
        <Route path='/rooms' render={routeProps => (
          <section className='home'>
            <RoomsIndex {...routeProps} />
            {currentUser &&
              <Route path='/rooms/:id' component={Room} />
            }
          </section>
        )} />
        <Redirect to='/rooms' />
      </Switch>
    </>
  );
}

export default App;
