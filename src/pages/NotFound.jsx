import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/auth.css';

const NotFound = () => (
    <div className="container auth-notfound">
        <div className="auth-notfound-code">404</div>
        <h1 className="auth-notfound-text">This page doesn't exist.</h1>
        <Link to="/" className="pill-btn inverse lg">
            Back to Home
        </Link>
    </div>
);

export default NotFound;
