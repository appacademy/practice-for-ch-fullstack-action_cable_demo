import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { logout } from '../store/users';
import Dropdown from './Dropdown';
import Mentions from './Mentions';

function NavBar () {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.users[state.currentUserId]);
  
  return (
    <nav className='navbar'>
      <NavLink exact to='/rooms'>Home</NavLink>
      {currentUser
        ? (
          <>
            <Mentions />
            <Dropdown
              className='logout'
              render={({ toggleOpen, isOpen }) => (
                <>
                  <span onClick={toggleOpen}>
                    {currentUser.username}
                    <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} />
                  </span>
                  <div className='dropdown' hidden={!isOpen}>
                    <button
                      className='btn-primary'
                      onClick={() => dispatch(logout())}
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            />
          </>
        ) : (
          <>
            <NavLink to='/login'>Login</NavLink>
            <NavLink to='/signup'>Signup</NavLink>
          </>
        )
      }
    </nav>
  );
}

export default NavBar;
