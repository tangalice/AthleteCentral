import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    setDoc,
} from "firebase/firestore";
import TopBar from "./TopBar";

const Goals = () => {
    const [user, setUser] = useState(null);
    const [goals, setGoals] = useState([]);
    const [newGoal, setNewGoal] = useState("");
    const [category, setCategory] = useState("Academic");
    const [filters, setFilters] = useState({
        Academic: true,
        Practice: true,
        Competition: true,
    });

    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged((u) => {
            setUser(u);
            if (u) listenToGoals(u.uid);
            else setGoals([]);
        });
        return () => unsubAuth();
    }, []);

    const listenToGoals = (uid) => {
        const goalsRef = collection(db, "users", uid, "goals");
        const q = query(goalsRef, orderBy("createdAt", "asc"));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setGoals(data);
        });
    };

    const handleAddGoal = async (e) => {
        e.preventDefault();
        if (!user || !newGoal.trim()) return;
        const goalRef = doc(db, "users", user.uid);
        await setDoc(goalRef, { email: user.email }, { merge: true });
        await addDoc(collection(db, "users", user.uid, "goals"), {
            title: newGoal.trim(),
            category,
            completed: false,
            createdAt: new Date(),
        });
        setNewGoal("");
    };

    const handleDelete = async (goalId) => {
        if (!user) return;
        await deleteDoc(doc(db, "users", user.uid, "goals", goalId));
    };

    const toggleCompleted = async (goalId, completed) => {
        if (!user) return;
        await updateDoc(doc(db, "users", user.uid, "goals", goalId), {
            completed: !completed,
        });
    };

    const handleEdit = async (goalId, newTitle) => {
        if (!user) return;
        await updateDoc(doc(db, "users", user.uid, "goals", goalId), {
            title: newTitle,
        });
    };

    const handleFilterChange = (category) => {
        setFilters((prev) => ({ ...prev, [category]: !prev[category] }));
    };

    const visibleGoals = goals.filter((g) => filters[g.category]);

    return (
        <div className="min-h-screen bg-gray-50">
            <TopBar />
            <div className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Goal Tracker</h1>

                <form
                    onSubmit={handleAddGoal}
                    className="flex flex-col sm:flex-row gap-3 mb-6"
                >
                    <input
                        type="text"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        placeholder="Enter a new goal"
                        className="flex-1 border rounded-md px-3 py-2 text-gray-700 focus:outline-none focus:ring focus:ring-green-300"
                    />
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="border rounded-md px-3 py-2 text-gray-700 focus:outline-none focus:ring focus:ring-green-300"
                    >
                        <option value="Academic">Academic</option>
                        <option value="Practice">Practice</option>
                        <option value="Competition">Competition</option>
                    </select>
                    <button
                        type="submit"
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
                    >
                        Add Goal
                    </button>
                </form>

                <div className="flex justify-around mb-5">
                    {Object.keys(filters).map((cat) => (
                        <label key={cat} className="flex items-center gap-2 text-gray-700">
                            <input
                                type="checkbox"
                                checked={filters[cat]}
                                onChange={() => handleFilterChange(cat)}
                            />
                            {cat}
                        </label>
                    ))}
                </div>

                <div className="space-y-3">
                    {visibleGoals.map((goal) => (
                        <GoalItem
                            key={goal.id}
                            goal={goal}
                            onDelete={() => handleDelete(goal.id)}
                            onToggle={() => toggleCompleted(goal.id, goal.completed)}
                            onEdit={(newTitle) => handleEdit(goal.id, newTitle)}
                        />
                    ))}
                    {visibleGoals.length === 0 && (
                        <p className="text-gray-500 text-center">No goals to display.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const GoalItem = ({ goal, onDelete, onToggle, onEdit }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(goal.title);

    const handleSave = () => {
        if (tempTitle.trim()) {
            onEdit(tempTitle.trim());
            setIsEditing(false);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-start justify-between">
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    checked={goal.completed}
                    onChange={onToggle}
                    className="mt-1"
                />
                <div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                            autoFocus
                            className="border-b border-gray-300 focus:border-green-500 outline-none text-lg text-gray-700"
                        />
                    ) : (
                        <h3
                            className={`text-lg font-medium ${goal.completed ? "line-through text-gray-400" : "text-gray-800"
                                }`}
                            onClick={() => setIsEditing(true)}
                        >
                            {goal.title}
                        </h3>
                    )}
                    <p className="text-sm text-gray-500 mt-1 italic">
                        Category: {goal.category}
                    </p>
                </div>
            </div>

            <button
                onClick={onDelete}
                className="text-gray-400 hover:text-red-500 transition"
            >
                ✖
            </button>
        </div>
    );
};

export default Goals;