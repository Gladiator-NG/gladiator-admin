import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useForm } from 'react-hook-form';
import Button from '../../ui/Button';
import FormInput from '../../ui/formElements/FormInput';
import { useSignIn } from './useSignIn';
import styles from './styles/SignInForm.module.css';

interface SignInFormData {
  email: string;
  password: string;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 18,
    },
  },
};

function SignInForm() {
  const { signIn, isPending } = useSignIn();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>();

  function onSubmit(data: SignInFormData) {
    signIn(data);
  }

  return (
    <motion.div
      className={styles.card}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <img
        src="/gladiator_icon.png"
        alt="Gladiator logo"
        className={styles.logo}
      />

      <h2 className={styles.heading}>Sign in with your email</h2>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          id="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          formActions={{ register, errors }}
          disabled={isPending}
        />

        <FormInput
          id="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          formActions={{ register, errors }}
          disabled={isPending}
        />

        <Button
          variant="primary"
          type="submit"
          className={styles.submitBtn}
          disabled={isPending}
        >
          {isPending ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <Button variant="link-dark" type="button">
        Forgot Password?
      </Button>
    </motion.div>
  );
}

export default SignInForm;
