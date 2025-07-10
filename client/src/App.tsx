import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import useSocket from "./hooks/useSocket";
import Login from "./components/Login";
import Register from "./components/Register";
import Chat from "./components/Chat";
import LoadingSpinner from "./components/LoadingSpinner";

interface RegistrationResponse {
  message: string;
  user: {
    _id: string;
    username: string;
    email: string;
  };
}

// Authentication and routing wrapper component
const AppContent = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [authTrigger, setAuthTrigger] = useState(0);
  const navigate = useNavigate();

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedData = JSON.parse(userData);
      if (parsedData && parsedData.accessToken) {
        setIsAuthenticated(true);
      }
    } else {
      setIsAuthenticated(false);
    }
  }, [authTrigger]);

  // Update state when connection is established
  useEffect(() => {
    if (isConnected && isConnecting) {
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting]);

  // Socket event listeners for registration
  useEffect(() => {
    if (!socket) return;

    const handleRegistrationSuccess = (data: RegistrationResponse) => {
      setIsRegistering(false);
      setRegistrationError("");
      console.log("Registration successful:", data);
      // Navigate to login after successful registration
      navigate("/login");
    };

    const handleRegistrationError = (error: string) => {
      setIsRegistering(false);
      setRegistrationError(error);
    };

    const handleLoginSuccess = (data: {
      message: string;
      user: { id: string; username: string; email: string };
      accessToken: string;
      refreshToken: string;
    }) => {
      setIsConnecting(false);
      console.log("Login successful:", data);

      const userDataToStore = {
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
      localStorage.setItem("user", JSON.stringify(userDataToStore));
      setIsAuthenticated(true);
      setAuthTrigger((prev) => prev + 1); // Trigger auth re-check
    };

    const handleLoginError = (error: string) => {
      setIsConnecting(false);
      setRegistrationError(error);
      console.error("Login error:", error);
    };

    socket.on("registrationSuccess", handleRegistrationSuccess);
    socket.on("registrationError", handleRegistrationError);
    socket.on("loginSuccess", handleLoginSuccess);
    socket.on("loginError", handleLoginError);

    return () => {
      socket.off("registrationSuccess", handleRegistrationSuccess);
      socket.off("registrationError", handleRegistrationError);
    };
  }, [socket, navigate]);

  const handleLogin = (username: string, password: string) => {
    if (!socket) {
      console.error("❌ Socket not available");
      setRegistrationError("Connection not available. Please try again.");
      return;
    }
    if (!isConnected) {
      console.error("❌ Socket not connected");
      setRegistrationError("Not connected to server. Please try again.");
      return;
    }
    console.log("✅ Emitting registerUser event...");
    const userData = { username, password };
    console.log("🚀 ~ handleLogin called with:", userData);
    socket.emit("loginUser", userData);
    setIsConnecting(true);
  };

  const handleRegister = (userData: {
    username: string;
    email: string;
    password: string;
  }) => {
    if (!socket) {
      console.error("❌ Socket not available");
      setRegistrationError("Connection not available. Please try again.");
      return;
    }

    if (!isConnected) {
      console.error("❌ Socket not connected");
      setRegistrationError("Not connected to server. Please try again.");
      return;
    }

    console.log("✅ Emitting registerUser event...");
    setIsRegistering(true);
    setRegistrationError("");
    socket.emit("registerUser", userData);
  };

  // const handleLogout = () => {
  //   localStorage.removeItem("user");
  //   setIsAuthenticated(false);
  //   setAuthTrigger((prev) => prev + 1); // Trigger auth re-check
  // };

  // Show loading when connecting
  if (isConnecting) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">Connecting to chat...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/chat" replace />
          ) : (
            <Login onLogin={handleLogin} isConnecting={isConnecting} />
          )
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to="/chat" replace />
          ) : (
            <Register
              onRegister={handleRegister}
              isRegistering={isRegistering}
              error={registrationError}
            />
          )
        }
      />
      <Route
        path="/chat"
        element={isAuthenticated ? <Chat /> : <Navigate to="/login" replace />}
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
