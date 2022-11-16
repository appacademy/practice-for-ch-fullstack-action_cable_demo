import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { createRoom, destroyRoom, fetchRooms } from '../store/rooms';

function RoomsIndex() {
  const [name, setName] = useState('');
  const currentUserId = useSelector(state => state.currentUserId);
  const rooms = useSelector(state => Object.values(state.rooms));
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchRooms());
  }, [dispatch]);

  const createNewRoom = e => {
    e.preventDefault();
    dispatch(createRoom({ ownerId: currentUserId, name }));
    setName('');
  }

  return (
    <section className='rooms-index home-section'>
      <h1>Rooms</h1>
      <ul>
        {rooms.map(({ id, name, ownerId }) => (
          <li key={id}>
            <NavLink to={currentUserId ? `/rooms/${id}` : '/login'}>
              {name}
            </NavLink>
            {ownerId === currentUserId && (
              <button
                className='btn-delete'
                onClick={() => dispatch(destroyRoom(id))}
              >
                x
              </button>
            )}
          </li>
        ))}
      </ul>
      {!!currentUserId &&
        <form onSubmit={createNewRoom}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button className='btn-primary' disabled={!name}>
            Create Room
          </button>
        </form>
      }
    </section >
  );
}

export default RoomsIndex;