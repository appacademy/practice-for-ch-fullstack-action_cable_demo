import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { login, signup } from '../store/users';

function SessionForm ({title}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState([]);
  const history = useHistory();
  const dispatch = useDispatch();
  const submitForm = title === 'Login' ? login : signup;

  const handleChange = field => {
    return ({ target: { value } }) => { 
      field === 'username' ? setUsername(value) : setPassword(value)
      if (errors.length !== 0) setErrors([]);
    }
  }

  const handleSubmit = e => {
    e.preventDefault();
    dispatch(submitForm({ username, password })).then(
      () => history.push('/rooms'),
      (errors) => {
          setUsername('');
          setPassword('');
          setErrors(errors);
      }
    );
  }

  const handleDemo = username => {
    dispatch(login({ username, password: '123456' })).then(
      () => history.push('/rooms')
    );
  }

  return (
    <section className='session-page'>
      <h1>{title}</h1>
      <ul className='errors'>
        {errors.map(error => (
          <li key={error}>{error}</li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label>Username
          <input
            type="text"
            value={username}
            onChange={handleChange('username')}
          />
        </label>
        <label>Password
          <input
            type="password"
            value={password}
            onChange={handleChange('password')}
          />
        </label>
        <button className='btn-primary'>Submit</button>
      </form>
      <div className='demo-btns'>
        <button
          className='btn-primary'
          onClick={() => handleDemo('garfield')}
        >
          Login as Garfield
        </button>
        <button
          className='btn-primary'
          onClick={() => handleDemo('sennacy')}
        >
          Login as Sennacy
        </button>
      </div>
    </section>
  );
}

export const LoginForm = () => <SessionForm title='Login' />;
export const SignupForm = () => <SessionForm title='Sign Up' />;
