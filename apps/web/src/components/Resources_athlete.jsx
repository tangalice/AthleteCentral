// src/components/Resources_athlete.jsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, serverTimestamp, deleteDoc } from "firebase/firestore";

export default function Resources_athlete({ user }) {
  console.log("user", user);
  const [resources, setResources] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [message, setMessage]= useState(null);
  const [requestedIds, setRequestedIds] = useState([]);
  const [amounts, setAmounts] = useState([]);
  const [filteredResources, setFilteredResources] = useState([]);
  const defaultDate = new Date()
  const [requests, setRequests] = useState([]);

  const updateAmounts = (id, value) => {
    setAmounts(prev => ({ ...prev, [id]: value }));
  };

  const [newRequest, setNewRequest] = useState({
    participants: 0,
    startTime: defaultDate,
    endTime: defaultDate,
    location: "",
    description: "",
    team: ""
  })

  const toggleResource = (resourceId) => {
    setRequestedIds(prev => 
      prev.includes(resourceId) 
        ? prev.filter(id => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  const createRequest = async () => {
    if (!user) {
      setMessage("user error");
      return;
    }
    if (!newRequest.location.trim()) {
      setMessage("Location is required");
      return;
    }
    if (newRequest.participants < 1) {
      setMessage("Number of participants is required");
      return;
    } 
    if (!newRequest.team.trim()) {
      setMessage("Team is required");
      return;
    }
    if (newRequest.startTime === newRequest.endTime) {
      setMessage("Invalid times chosen");
      return;
    }
    if (requestedIds.length === 0) {
      setMessage("No resources selected");
      return;
    }
    console.log("requestedIds: ", requestedIds);

    try {
      const requestData = {
        user: user.displayName,
        uid: user.uid,
        location: newRequest.location.trim(),
        description: newRequest.description.trim() || "",
        participants: newRequest.participants,
        team: newRequest.team,
        startTime: newRequest.startTime,
        endTime: newRequest.endTime,
        resources: requestedIds.map(resource => ({id: resource, amount: amounts[resource]})),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "pending"
      };
      console.log("requestData: ", requestData);

      const requestRef = await addDoc(collection(db, "resourceRequests"), requestData);
      const requestId = requestRef.id;

      setShowRequestForm(false);
      setNewRequest({
        participants: 0,
        startTime: defaultDate,
        endTime: defaultDate,
        location: "",
        description: "",
        team: ""
      });
      setRequestedIds([]);
      setMessage(null);
      requests.push(requestData);
    }
    catch (error) {
      setMessage(`error creating resource: ${error.message}`)
    }
  }

  //load teams and resources
    useEffect(() => {
      const fetchResources = async () => {
        try {
          const teamQuery = query(
            collection(db, "teams"),
            where("members", "array-contains", user.uid)
          );
          const snapshot = await getDocs(teamQuery);
          const loadedTeams = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
          }));
          const teamIds = snapshot.docs.map(doc => doc.id);
          console.log("loadedTeams: ", loadedTeams);
          setTeams(loadedTeams);

          console.log("teamIds: ", teamIds);
          const resourceQuery = query(
            collection(db, "resources"),
            where("teams", "array-contains-any", teamIds))
          ;
          const snap = await getDocs(resourceQuery);
          const loadedResources = snap.docs.map( doc => ({
            id: doc.id,
            name: doc.data().name,
            amount: doc.data().amount,
            description: doc.data().description,
            teams: doc.data().teams
          }))
          console.log("loadedResources: ", loadedResources);
          setResources(loadedResources);

          const requestQuery = query(collection(db, "resourceRequests"), where("uid", "==", user.uid));
          const s = await getDocs(requestQuery);
          const loadedRequests = s.docs.map( doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log("loadedRequests", loadedRequests);
          setRequests(loadedRequests);
        }
        catch (error) {
          console.error("error loading resources: ", error);
        }
      };
      fetchResources();
    }, []);


  console.log("resources: ", resources);
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
    <h1 style={{ 
        fontSize: '32px', 
        fontWeight: 700, 
        marginBottom: '24px', 
        color: '#111827' 
      }}>
      Available Resources
    </h1>
    <p className="text-muted" style={{ marginBottom: 24 }}>
      View and request resources available to your team
    </p>

    {/* Create Request Button */}
    <div className="card" style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <button
        className="btn btn-primary"
        onClick={() => setShowRequestForm(true)}
      >
      Request Resource
      </button>
    </div>
    </div>

    {/* Create Request Modal */}
    {showRequestForm && (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}>
      <div className="card" style={{ maxWidth: 600, width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
        <h2 style={{ marginBottom: 16 }}>Create New Resource Request</h2>
              
        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Location *</label>
            <input
              type="text"
              className="form-control"
              value={newRequest.location}
              onChange={(e) => setNewRequest(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Enter the location for your request"
            />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Description</label>
            <textarea
              className="form-control"
              value={newRequest.description}
              onChange={(e) => setNewRequest(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter description for your request (optional)"
              rows={3}
            />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Number of Participants *</label>
            <input
              type="number"
              min="1"
              className="form-control"
              value={newRequest.participants}
              onChange={(e) => setNewRequest(prev => ({ ...prev, participants: e.target.value }))}
              placeholder='1'
            />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Start Time *</label>
            <input
              type="datetime-local"
              className="form-control"
              value={newRequest.startTime}
              onChange={(e) => setNewRequest(prev => ({ ...prev, startTime: e.target.value }))}
              placeholder='Select a time'
            />

            <label style={{ fontWeight: 700 }}>End Time *</label>
            <input
              type="datetime-local"
              className="form-control"
              value={newRequest.endTime}
              onChange={(e) => setNewRequest(prev => ({ ...prev, endTime: e.target.value }))}
              placeholder='Select a time'
            />
        </div>

         {/* Target Team */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>
              Teams *
            </label>
            <div style={{ 
              border: "1px solid #eee", 
              padding: 12, 
              borderRadius: 8, 
              maxHeight: 150, 
              overflowY: "auto" 
            }}>
              {teams.length === 0 ? (
                <p className="text-muted">No teams found. You need to create or join a team first.</p>
              ) : (
                  <label 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 10, 
                      marginBottom: 8, 
                      cursor: "pointer" 
                    }}
                  >
                    <select
                      type="dropdown"
                      onChange={(e) => {
                        setNewRequest(prev => ({ ...prev, team: e.target.value }));
                        setFilteredResources(resources.filter(resource => resource.teams.includes(e)));
                      }}
                    >
                    <option key="" value="">Select a team...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                    </select>

                  </label>
                )}
              
            </div>
          </div>

          {/* Resource selection */}
          {newRequest.team != "" && (
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>
              Resources Needed *
            </label>
            <div style={{ 
              border: "1px solid #eee", 
              padding: 12, 
              borderRadius: 8, 
              maxHeight: 150, 
              overflowY: "auto" 
            }}>
              {resources.length === 0 ? (
                <p className="text-muted">No resources found for the selected team.</p>
              ) : (
                resources.map(resource => (
                  <label 
                    key={resource.id} 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 10, 
                      marginBottom: 8, 
                      cursor: "pointer" 
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={requestedIds.includes(resource.id)}
                      onChange={() => toggleResource(resource.id)}
                      style={{ width: 18, height: 18 }}
                    />
                    {resource.name}

                    <input
                      type="number"
                      min="0"
                      max={resource.amount}
                      value={amounts[resource.id] || ""}
                      onChange={e => updateAmounts(resource.id, e.target.value)}
                      placeholder='1'
                    />
                  </label>
                  
                ))
              )}
            </div>
          </div>
          )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowRequestForm(false)}
          >
          Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={createRequest}
          >
          Create Resource
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`alert ${message.includes("Error") ? "alert-error" : "alert-success"}`} role="status" style={{ marginTop: 16 }}>
            {message}
          </div>
        )}
      </div>
      </div>
    )}

    {/* Resource Listing */}
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>Team Resources ({resources.length})</h2>
          
      {resources.length === 0 ? (
        <p className="text-muted">Your coach has not added any resources yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {resources.map(resource => (
            <div key={resource.id} style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 8px 0" }}>{resource.name}</h3>
                  <p className="text" style={{ margin: "0 0 8px 0" }}>Amount: {resource.amount}</p>
                  {resource.description && (
                    <p className="text-muted" style={{ margin: "0 0 8px 0" }}>{resource.description}</p>
                  )}

                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Resource Request Listings */}
    <div className="card">
          <h2 style={{ marginBottom: 16 }}>Resource Requests ({requests.length})</h2>
          
          {requests.length === 0 ? (
            <p className="text-muted">There are currently no open resource requests</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {requests.map(request => (
                <div key={request.id} style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 8px 0" }}>{request.user}</h3>
                      {request.description && (
                        <p className="text-muted" style={{ margin: "0 0 8px 0" }}>{request.description}</p>
                      )}

                    </div>
                    <p>{request.status}</p>
                    {request.status === "pending" && ( 
                    <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowRequestForm(true)}
                        style={{ fontSize: 14, padding: "6px 12px" }}
                      >
                        View Request
                      </button>
                      </div>
                    )}
                    
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>

    </div>
    </div>
  )
}