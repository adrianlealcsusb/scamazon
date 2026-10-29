/**
 * Scamazon - Login & Account Creation Portal Logic
 */
let isSignUp = false;

        const authForm = document.getElementById('auth-form');
        const nameInput = document.getElementById('name');
        const nameContainer = document.getElementById('name-container');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const submitBtn = document.getElementById('submit-btn');
        const toggleBtn = document.getElementById('toggle-btn');
        const toggleText = document.getElementById('toggle-text');
        const formTitle = document.getElementById('form-title');
        const formSubtitle = document.getElementById('form-subtitle');
        const errorDiv = document.getElementById('error-msg');
        const successDiv = document.getElementById('success-msg');

        toggleBtn.addEventListener('click', () => {
            isSignUp = !isSignUp;
            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');

            if (isSignUp) {
                nameContainer.classList.remove('hidden');
                formTitle.textContent = 'Create Account';
                formSubtitle.textContent = 'Register a new customer account';
                submitBtn.textContent = 'Sign Up';
                toggleText.textContent = 'Already have an account?';
                toggleBtn.textContent = 'Sign In';
            } else {
                nameContainer.classList.add('hidden');
                formTitle.textContent = 'Sign In';
                formSubtitle.textContent = 'Access your dashboard';
                submitBtn.textContent = 'Sign In';
                toggleText.textContent = "Don't have an account?";
                toggleBtn.textContent = 'Sign Up';
            }
        });

        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            try {
                if (isSignUp) {
                    const name = nameInput.value.trim();
                    const { data, error } = await client.auth.signUp({
                        email,
                        password,
                        options: { data: { role: 'customer', name } }
                    });

                    if (error) throw error;

                    successDiv.textContent = 'Account created successfully. You can now sign in.';
                    successDiv.classList.remove('hidden');
                    toggleBtn.click();
                } else {
                    const { data, error } = await client.auth.signInWithPassword({ email, password });
                    if (error) throw error;

                    const { data: userRecord } = await client
                        .from('users')
                        .select('role')
                        .eq('email', email)
                        .maybeSingle();

                    const role = userRecord?.role || data?.user?.user_metadata?.role || 'customer';

                    if (role === 'storefront_owner') {
                        window.location.href = 'storefront';
                    } else {
                        window.location.href = `${role}`;
                    }
                }
            } catch (err) {
                errorDiv.textContent = err.message;
                errorDiv.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
            }
        });
