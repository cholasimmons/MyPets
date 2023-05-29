import { ID, type Models, Permission, Role, Query } from 'appwrite';
import { get, writable } from 'svelte/store';
import { sdk, server } from './appwrite';
import type { Gender, Pet, Type } from './_models/pet-model';
import type { Account } from './_models/appwrite-model';
import type { Clinic } from './_models/clinic-model';

export type Alert = {
  color: string;
  message: string;
};

// PETS

const createPets = () => {
  const { subscribe, update, set } = writable<Pet[]|null>([]);

  return {
    subscribe,
    fetch: async () => {
      const userID = get(state).account!.$id;
      const role = Role.user(userID,'verified');
      if(!role)return;
  
      const response = await sdk.database.listDocuments(server.database, server.collection_pets, [Query.orderDesc('')]);
      console.log(response.documents);
      return set(response.documents as any);
    },
    addPet: async (name:string, type: Type, gender: Gender, breed: string) => {
      const userID = get(state).account!.$id;
      const role = Role.user(userID);
      if(!role)return;

      const pet = await sdk.database.createDocument<Pet>(
        server.database,
        server.collection_pets,
        ID.unique(),
        {
          name,
          type,
          gender,
          breed,
          ownerID: [userID]
        },
        [
          Permission.read(role),
          Permission.update(role),
          Permission.delete(role),
        ]
      );
      // const petphoto = await sdk.storage.createFile(server.bucket_buddies,ID.unique(),photofile)
      // document.getElementById('uploader').files[0]
      update((n) => [pet, ...n!]);
      return pet;
    },

    removePet: async (pet: Pet) => {
      await sdk.database.deleteDocument(server.database, server.collection_pets, pet.$id);
      return update((n) => n!.filter((t) => t.$id !== pet.$id));
    },
    updatePet: async (pet: Pet, body: {[key:string]:any[]}) => { // Partial<Pet>
      const userID = get(state).account!.$id;
      const role = Role.user(userID);
      await sdk.database.updateDocument(
        server.database,
        server.collection_pets,
        pet.$id,
        body,
        [
          Permission.read(role),
          Permission.update(role),
          Permission.delete(role),
        ]
      );
      return update((n) => {
        const index = n!.findIndex((t) => t.$id === pet.$id);
        n![index] = {
          ...n![index],
          ...(<Pet>pet),
        };
        return n;
      });
    },
    clear: async () => {
      return set(null);
    },
  };
};

// VETS

const createClinics = () => {
  const { subscribe, update, set } = writable<Clinic[]>([]);

  return {
    subscribe,
    fetch: async () => {
      const response: any = await sdk.database.listDocuments(server.database, server.collection_clinics);
      return set(response.documents);
    },
    addClinic: async (name: string, city: string) => {
      const user = Role.user(get(state).account!.$id);
      // console.log('User: ',user);
      
      const clinic = await sdk.database.createDocument<Clinic>(
        server.database,
        server.collection_clinics,
        ID.unique(),
        {
          name,
          city,
        },
        [
          Permission.read('any'),
          Permission.update(user),
          Permission.delete(user),
        ]
      );
      return update((n) => [clinic, ...n]);
    },

    removeClinic: async (clinic: Clinic) => {
      await sdk.database.deleteDocument(server.database, server.collection_clinics, clinic.$id);
      return update((n) => n.filter((t) => t.$id !== clinic.$id));
    },
    updateClinic: async (clinic: Clinic) => { // Partial<Clinic>
      const user = Role.user(get(state).account!.$id);
      await sdk.database.updateDocument(
        server.database,
        server.collection_clinics,
        clinic.$id,
        clinic,
        [
          Permission.read('any'),
          Permission.update(user),
          Permission.delete(user),
        ]
      );
      return update((n) => {
        const index = n.findIndex((c) => c.$id === clinic.$id);
        n[index] = {
          ...n[index],
          ...(<Clinic>clinic),
        };
        return n;
      });
    },
  };
};

// STORAGE

const createPetPhoto = () => {
  const { subscribe, update, set } = writable([]);

  return {
    subscribe,
    fetch: async () => {
      const userId = get(state).account!.$id;
      const role = Role.user(userId, 'verified');
      if(!role)return;
  
      try {
        const response: any = await sdk.storage.listFiles(server.bucket_buddies);
        set(response.documents);
      } catch (error) {
        console.error('Failed to fetch pet photos:', error);
      }
    },
    addPetPhoto: async (file: File) => {
      const userID = get(state).account!.$id;
      const role = Role.user(userID);
      if(!role)return;

      try {
        const photoBucket = await sdk.storage.createFile(
          server.bucket_buddies,
          ID.unique(),
          file,
          [
            Permission.read(role),
            Permission.update(role),
            Permission.delete(role),
          ]
        );
        update((photos) => [...photos]);
        return photoBucket;
      } catch (error) {
        console.error('Failed to add pet photo:', error);
      }
    },
    getPreview: async (id: string) => {
      const userID = get(state).account!.$id;
      const role = Role.user(userID);
      if(!role)return;

      try {
        const photoPreview = await sdk.storage.getFilePreview(
          server.bucket_buddies,
          id
        );
        update((photos) => [...photos]);
        return photoPreview;
      } catch (error) {
        console.error('Failed to retrieve preview photo:', error);
      }
    }
  }
}

// User Account state

const createState = () => {
  const { subscribe, set, update } = writable({
    account: null as Account|null,
    alert: null as Alert|null,
    _loading: false
  });

  const setLoading = (isLoading: boolean)=>{
    update(state => ({...state, _loading: isLoading}));
  }

  return {
    subscribe,
    checkLoggedIn: async () => {
      setLoading(true);
      const account = await sdk.account.get();
      state.init(account);
      setLoading(false);
  },
    signup: async (email: string, password: string, name: string) => {
      setLoading(true);
      const result = await sdk.account.create('unique()', email, password, name);
      setLoading(false);
      return result;
    },
    login: async (email: string, password: string) => {
      setLoading(true);
      await sdk.account.createEmailSession(email, password);
      const user = await sdk.account.get();
      state.init(user);
      setLoading(false);
    },
    logout: async () => {
      setLoading(true);
      await sdk.account.deleteSession('current');
      state.init();
      petstate.clear();
      // petbucketstate.clear();
      setLoading(false);
    },
    alert: async (alert: Alert) =>
      update((n) => {
        n.alert = alert;
        return n;
      }),
    init: async (account: any = null) => {
      return set({ account, alert: null, _loading: false });
    },
  };
};

export const petstate = createPets();
export const petbucketstate = createPetPhoto();
export const clinicstate = createClinics();
export const state = createState();
