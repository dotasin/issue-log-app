import mongoose from 'mongoose';
import { logger } from './logger';

// Database class that implements Singleton pattern for MongoDB connection management
export class Database {
  // Static instance property to hold the single instance of Database class
  private static instance: Database;
  
  // Boolean flag to track connection status
  private isConnected: boolean = false;

  // Private constructor prevents direct instantiation - enforces Singleton pattern
  private constructor() {}

  // Static method that returns the single instance of Database class
  // If instance doesn't exist, it creates one (lazy initialization)
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  // Method to establish connection to MongoDB
  public async connect(): Promise<void> {
    // Check if already connected to avoid multiple connections
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    try {
      // Get MongoDB connection string from environment variables
      const mongoUri = process.env.MONGODB_URI;
      
      // Validate that the connection string exists
      if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable is not defined');
      }

      // Establish connection to MongoDB using Mongoose
      await mongoose.connect(mongoUri);
      
      // Update connection status flag
      this.isConnected = true;
      logger.info('Successfully connected to MongoDB Atlas');

      // Set up event listeners for connection state changes
      
      // Handle connection errors
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      // Handle disconnection events
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      // Handle reconnection events
      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

      // Handle graceful shutdown when process receives SIGINT signal (Ctrl+C)
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      // Log and re-throw any connection errors
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  // Method to disconnect from MongoDB
  public async disconnect(): Promise<void> {
    // Check if connection exists before attempting to disconnect
    if (!this.isConnected) {
      return;
    }

    try {
      // Close MongoDB connection
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      // Log and re-throw any disconnection errors
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  // Method to check if connection is active
  // Checks both internal flag and Mongoose connection state
  public isConnectionActive(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  // Method to get human-readable connection state
  public getConnectionState(): string {
    // Mapping of Mongoose connection states to readable strings
    const states = {
      0: 'disconnected',    // Connection is closed
      1: 'connected',       // Connection is open and ready
      2: 'connecting',      // Connection is in the process of connecting
      3: 'disconnecting',   // Connection is in the process of disconnecting
      99: 'uninitialized'   // Connection has not been initialized
    };
    // Return the current state or 'unknown' if state is not recognized
    return states[mongoose.connection.readyState] || 'unknown';
  }
}

// Export a singleton instance of Database class for use throughout the application
export const database = Database.getInstance();