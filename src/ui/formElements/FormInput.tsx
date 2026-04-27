import type {
  FieldErrors,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from 'react-hook-form';
import styles from './styles/FormInput.module.css';

// Generic FormActions type — works with any schema
export interface FormActions<T extends FieldValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}

interface BaseProps<T extends FieldValues> {
  id: Path<T>;
  label: string;
  formActions: FormActions<T>;
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  disabled?: boolean;
  onChange?: React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
  validation?: RegisterOptions<T, Path<T>>;
  className?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
}

// Type discriminated union so select needs children, others don't
type SelectProps<T extends FieldValues> = BaseProps<T> & {
  type: 'select';
  children: React.ReactNode;
};

type OtherProps<T extends FieldValues> = BaseProps<T> & {
  type?:
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'tel'
    | 'textarea'
    | 'date'
    | 'time'
    | 'url'
    | 'search';
  children?: never;
};

type FormInputProps<T extends FieldValues> = SelectProps<T> | OtherProps<T>;

function FormInput<T extends FieldValues>({
  id,
  type = 'text',
  label,
  placeholder,
  defaultValue,
  formActions,
  onChange,
  required = true,
  disabled = false,
  validation = {},
  children,
  className,
  min,
  max,
  step,
}: FormInputProps<T>) {
  const { register, errors } = formActions;

  const requiredCheck = (value: unknown) =>
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
      ? 'This field is required'
      : true;

  const mergeValidate = (
    existing: RegisterOptions<T, Path<T>>['validate'],
  ): RegisterOptions<T, Path<T>>['validate'] => {
    if (!required) return existing;

    if (!existing) return requiredCheck;

    if (typeof existing === 'function') {
      return (value, formValues) => {
        const requiredResult = requiredCheck(value);
        if (requiredResult !== true) return requiredResult;
        return existing(value, formValues);
      };
    }

    return {
      requiredCheck,
      ...existing,
    };
  };

  const baseRules = {
    ...validation,
    validate: mergeValidate(validation.validate),
  } as RegisterOptions<T, Path<T>>;

  const emailRules = {
    ...baseRules,
    pattern: {
      value: /\S+@\S+\.\S+/,
      message: 'Please enter a valid email address',
    },
  } as RegisterOptions<T, Path<T>>;

  const telRules = {
    ...baseRules,
    pattern: {
      value: /^[+\d][\d\s\-().]*$/,
      message: 'Please enter a valid phone number',
    },
  } as RegisterOptions<T, Path<T>>;

  const urlRules = {
    ...baseRules,
    pattern: {
      value: /^https?:\/\/.+/,
      message: 'Please enter a valid URL (starting with http:// or https://)',
    },
  } as RegisterOptions<T, Path<T>>;

  const numberRules = {
    ...baseRules,
    setValueAs: (value: unknown) => {
      if (value === '' || value === null || value === undefined) return undefined;
      return Number(value);
    },
  } as RegisterOptions<T, Path<T>>;

  const hasError = Boolean(errors[id]);

  if (type === 'textarea') {
    return (
      <fieldset className={`${styles.fieldset} ${className ?? ''}`}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <textarea
          id={id}
          placeholder={placeholder}
          defaultValue={defaultValue}
          disabled={disabled}
          className={`${styles.textarea} ${hasError ? styles.textareaError : ''}`}
          {...register(id, baseRules)}
          {...(onChange !== undefined && {
            onChange: onChange as React.ChangeEventHandler<HTMLTextAreaElement>,
          })}
        />
        {hasError && (
          <p className={styles.warning} role="alert">
            {errors[id]?.message as string}
          </p>
        )}
      </fieldset>
    );
  }

  if (type === 'select') {
    return (
      <fieldset className={`${styles.fieldset} ${className ?? ''}`}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <select
          id={id}
          disabled={disabled}
          defaultValue={defaultValue}
          className={`${styles.select} ${hasError ? styles.selectError : ''}`}
          {...register(id, baseRules)}
          {...(onChange !== undefined && {
            onChange: onChange as React.ChangeEventHandler<HTMLSelectElement>,
          })}
        >
          {children}
        </select>
        {hasError && (
          <p className={styles.warning} role="alert">
            {errors[id]?.message as string}
          </p>
        )}
      </fieldset>
    );
  }

  const rulesForType =
    type === 'email'
      ? emailRules
      : type === 'tel'
        ? telRules
        : type === 'url'
          ? urlRules
          : type === 'number'
            ? numberRules
          : baseRules;

  return (
    <fieldset className={`${styles.fieldset} ${className ?? ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={disabled}
        className={`${styles.input} ${hasError ? styles.inputError : ''}`}
        {...register(id, rulesForType)}
        {...(onChange !== undefined && {
          onChange: onChange as React.ChangeEventHandler<HTMLInputElement>,
        })}
        {...(min !== undefined && { min })}
        {...(max !== undefined && { max })}
        {...(step !== undefined && { step })}
      />
      {hasError && (
        <p className={styles.warning} role="alert">
          {errors[id]?.message as string}
        </p>
      )}
    </fieldset>
  );
}

export default FormInput;
