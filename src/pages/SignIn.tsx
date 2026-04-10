import SignInForm from '../features/authentication/SignInForm';
import styles from './styles/SignIn.module.css';

function SignIn() {
  return (
    <div className={styles.page}>
      <SignInForm />
    </div>
  );
}

export default SignIn;
