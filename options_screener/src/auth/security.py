from cryptography.fernet import Fernet
import os

# Generar llave de cifrado (guarda este archivo secret.key en un lugar seguro)
def generate_key():
    key = Fernet.generate_key()
    with open("secret.key", "wb") as key_file:
        key_file.write(key)
    print("Llave secret.key generada.")

def encrypt_credentials(data: str):
    if not os.path.exists("secret.key"):
        generate_key()
        
    with open("secret.key", "rb") as key_file:
        key = key_file.read()
    f = Fernet(key)
    encrypted_data = f.encrypt(data.encode())
    with open("credentials.enc", "wb") as file:
        file.write(encrypted_data)
    print("Credenciales cifradas en credentials.enc.")

def get_credentials():
    if not os.path.exists("secret.key") or not os.path.exists("credentials.enc"):
        raise FileNotFoundError("Faltan archivos de seguridad (secret.key o credentials.enc)")
        
    with open("secret.key", "rb") as key_file:
        key = key_file.read()
    with open("credentials.enc", "rb") as file:
        encrypted_data = file.read()
    
    f = Fernet(key)
    decrypted_data = f.decrypt(encrypted_data).decode()
    return dict(item.split("=") for item in decrypted_data.split(","))

if __name__ == "__main__":
    # La cadena de prueba actual ya contiene tus formatos de Upstox
    generate_key()
   
