FROM crops/yocto:ubuntu-22.04-base

USER root

# Install ssh server
RUN apt-get update  \
    && apt-get install -y openssh-server \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && mkdir /var/run/sshd

EXPOSE 22

RUN ssh-keygen -A \
    && sed -i /etc/ssh/sshd_config -e 's/^#PermitEmptyPasswords no/PermitEmptyPasswords yes/' \
    && passwd -d yoctouser

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
CMD [ "/usr/local/bin/entrypoint.sh" ]
