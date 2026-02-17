// Mock user data for testing
export const mockUser = {
  id: 1,
  email: 'williamlopes100@icloud.com',
  firstName: 'William',
  lastName: 'Lopes',
  password: 'Tacoloco10!',
  token: 'mock-jwt-token-12345'
};

// Mock authentication function
export const mockLogin = async (email: string, password: string) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (email === mockUser.email && password === mockUser.password) {
    return {
      message: 'Login successful',
      user: {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        createdAt: new Date().toISOString()
      },
      token: mockUser.token
    };
  }
  
  throw new Error('Invalid credentials');
};
