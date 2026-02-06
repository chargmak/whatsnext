import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Calendar, List, User } from 'lucide-react';

const BottomNav = () => {
    return (
        <nav className="bottom-nav">
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Home />
                <span>Home</span>
            </NavLink>
            <NavLink to="/search" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Search />
                <span>Search</span>
            </NavLink>
            <NavLink to="/calendar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Calendar />
                <span>Calendar</span>
            </NavLink>
            <NavLink to="/library" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <List />
                <span>Library</span>
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <User />
                <span>Profile</span>
            </NavLink>
        </nav>
    );
};

export default BottomNav;
