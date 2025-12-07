// src/components/Resources_coach.jsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, serverTimestamp, deleteDoc } from "firebase/firestore";

export default function Resources_coach({ user }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [selectedTeamIds_edit, setSelectedTeamIds_edit] = useState([]);
  const [resourceToDelete, setResourceToDelete] = useState({});
  const [message, setMessage]= useState(null);
  const [resources, setResources] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const [newResource, setNewResource] = useState({
  name: "",
  description: "",
  amount: 1
  });

  const [editResource, setEditResource] = useState({
  name: "",
  description: "",
  amount: 1
  });

  const toggleTeam = (teamId) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const toggleTeam_edit = (teamId) => {
    setSelectedTeamIds_edit(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const createResource = async () => {
    if (!newResource.name.trim()) {
      setMessage("Resource name is required");
      return;
    }
    if (selectedTeamIds.length === 0) {
      setMessage("Please select a team");
      return;
    }

    try {
      const resourceData = {
        name: newResource.name.trim(),
        description: newResource.description.trim() || "",
        amount: newResource.amount,
        teams: selectedTeamIds,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      console.log("resourceData: ", resourceData);

      const resourceRef = await addDoc(collection(db, "resources"), resourceData);
      const resourceId = resourceRef.id;

      setShowCreateForm(false);
      setNewResource({ name: "", description: "", amount: 1 });
      setSelectedTeamIds([]);
      setMessage(null);
      resources.push({
        id: resourceId,
        name: resourceData.name,
        amount: resourceData.amount,
        description: resourceData.description,
        teams: selectedTeamIds
      });
    }
    catch (error) {
      setMessage(`error creating resource: ${error.message}`)
    }
  }

  const updateResource = async () => {
    if (!editResource.name.trim()) {
      setMessage("Resource name is required");
      return;
    }
    if (selectedTeamIds_edit.length === 0) {
      setMessage("Please select a team");
      return;
    }

    try {
      const resourceData = {
        name: editResource.name.trim(),
        description: editResource.description.trim() || "",
        amount: editResource.amount,
        teams: selectedTeamIds_edit,
        updatedAt: new Date()
      };
      console.log("resourceData: ", resourceData);

      await updateDoc(doc(db, "resources", editResource.id), resourceData);

      setShowEditForm(false);
      setNewResource({ name: "", description: "", amount: 1 });
      setSelectedTeamIds_edit([]);
      setMessage(null);

      const resources_new = [];
      for (let i = 0; i < resources.length; i++) {
        if (resources.at(i).id === editResource.id) {
          resources_new.push({
          id: editResource.id,
          name: editResource.name.trim(),
          description: editResource.description.trim() || "",
          amount: editResource.amount,
          teams: selectedTeamIds_edit,
          });
        }
        else {
          resources_new.push(resources.at(i));
        }
      }
      setResources(resources_new);

    }
    catch (error) {
      setMessage(`error updating resource: ${error.message}`)
    }
  }

  const deleteResource = async () => {
    try {
      await deleteDoc(doc(db, "resources", resourceToDelete.id));
      setMessage("Team deleted successfully");
      setShowDeleteForm(false);
      setResourceToDelete({});
      setMessage(null);

      const resources_new = [];
      for (let i = 0; i < resources.length; i++) {
        if (resources.at(i).id != resourceToDelete.id) {
          resources_new.push(resources.at(i));
        }
      }
      setResources(resources_new);
    } catch (error) {
      console.error("Error deleting team:", error);
      setMessage(`Error deleting team: ${error.message}`);
    }
  }

  //load teams and resources
    useEffect(() => {
      const fetchResources = async () => {
        try {
          const teamQuery = query(
            collection(db, "teams"),
            where("coaches", "array-contains", user.uid)
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

          const requestQuery = query(collection(db, "resourceRequests"), where ("team", "in", teamIds));
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


  console.log("yahoo");
  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
    <h1 style={{ 
        fontSize: '32px', 
        fontWeight: 700, 
        marginBottom: '24px', 
        color: '#111827' 
      }}>
      Team Resources
    </h1>
    <p className="text-muted" style={{ marginBottom: 24 }}>
      Create and manage resources available to your team
    </p>
    
    {/* Create Resource Button */}
    <div className="card" style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <button
        className="btn btn-primary"
        onClick={() => setShowCreateForm(true)}
      >
      Create New Resource
      </button>
    </div>
    </div>
        
    {/* Create Resource Modal */}
    {showCreateForm && (
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
        <h2 style={{ marginBottom: 16 }}>Create New Resource</h2>
              
        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Resource Name *</label>
            <input
              type="text"
              className="form-control"
              value={newResource.name}
              onChange={(e) => setNewResource(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter resource name"
            />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Description</label>
            <textarea
              className="form-control"
              value={newResource.description}
              onChange={(e) => setNewResource(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter resource description (optional)"
              rows={3}
            />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Amount Available</label>
            <input
              type="number"
              min="0"
              className="form-control"
              value={newResource.amount}
              onChange={(e) => setNewResource(prev => ({ ...prev, amount: e.target.value }))}
              placeholder='1'
            />
        </div>

         {/* Target Teams */}
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
                teams.map(team => (
                  <label 
                    key={team.id} 
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
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      style={{ width: 18, height: 18 }}
                    />
                    {team.name}
                  </label>
                ))
              )}
            </div>
          </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowCreateForm(false)}
          >
          Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={createResource}
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

    {/* Edit Resource Modal */}
    {showEditForm && (
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
        <h2 style={{ marginBottom: 16 }}>Edit Resource</h2>
              
        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Resource Name *</label>
            <input
              type="text"
              className="form-control"
              value={editResource.name}
              onChange={(e) => setEditResource(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter resource name"
            />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Description</label>
            <textarea
              className="form-control"
              value={editResource.description}
              onChange={(e) => setEditResource(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter resource description (optional)"
              rows={3}
            />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700 }}>Amount Available</label>
            <input
              type="number"
              min="0"
              className="form-control"
              value={editResource.amount}
              onChange={(e) => setEditResource(prev => ({ ...prev, amount: e.target.value }))}
              placeholder='1'
            />
        </div>

         {/* Target Teams */}
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
                teams.map(team => (
                  <label 
                    key={team.id} 
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
                      checked={selectedTeamIds_edit.includes(team.id)}
                      onChange={() => toggleTeam_edit(team.id)}
                      style={{ width: 18, height: 18 }}
                    />
                    {team.name}
                  </label>
                ))
              )}
            </div>
          </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowEditForm(false)}
          >
          Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={updateResource}
          >
          Update Resource
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

    {/* Delete Resource Modal */}
    {showDeleteForm && (
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
        <h2 style={{ marginBottom: 16 }}>Delete Resource</h2>
        <p>Are you sure you would like to delete this resource? This action is permanent and cannot be undone.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowDeleteForm(false)}
          >
          Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={deleteResource}
          >
          Delete Resource
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

    {/* View Request Form */}
    {showRequestForm && (
      <div></div>
    )}

    {/* Resources List */}
    <div className="card">
          <h2 style={{ marginBottom: 16 }}>My Resources ({resources.length})</h2>
          
          {resources.length === 0 ? (
            <p className="text-muted">You have not added any team resources yet</p>
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
                    <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setShowEditForm(true);
                          setEditResource(resource);
                          setSelectedTeamIds_edit(resource.teams);
                          }}
                        style={{ fontSize: 14, padding: "6px 12px" }}
                      >
                        Edit Resource
                      </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => {
                            setShowDeleteForm(true);
                            setResourceToDelete(resource);
                          }}
                          style={{ fontSize: 14, padding: "6px 12px" }}
                        >
                          Delete Resource
                        </button>
                      
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